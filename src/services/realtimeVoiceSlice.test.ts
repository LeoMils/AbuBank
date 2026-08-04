/*
 * PRODUCTION-FAITHFUL LIVE SLICE (ADR-0001 §12/§18) — real RealtimeVoiceSession, no mic.
 * ══════════════════════════════════════════════════════════════════════════════════════
 * Unlike the pure controller test, this drives an ACTUAL RealtimeVoiceSession instance
 * through its REAL handleEvent → sliceController → sendEvent path, using injectForTest to
 * capture the exact events the data channel would carry and to feed real-shaped server
 * events. It proves the function-tool journey traverses production code, and that the
 * session config declares tools + lets the model respond ONLY in slice mode.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeVoiceSession, buildRealtimeSessionUpdate } from './realtimeVoice'
import { REALTIME_COMM_TOOLS } from './realtimeToolSchemas'
import { RealtimeCommController } from '../screens/AbuAI/realtime/realtimeCommController'
import { SessionOrchestrator, type ActiveActionViewModel } from '../screens/AbuAI/realtime/sessionOrchestrator'
import { _resetIdempotencyForTests, type KernelFn } from '../screens/AbuAI/realtime/realtimeTools'

const ready: KernelFn = async ({ kind, recipientName }) => ({
  action: recipientName ? 'handoff' : 'clarify', mode: kind, recipientName: recipientName ?? null,
  canHandoff: !!recipientName, status: recipientName ? 'HANDOFF_AVAILABLE' : 'CLARIFY',
})
const noopCbs = {
  onStateChange: () => {}, onUserTranscript: () => {}, onAssistantTranscript: () => {},
  onAssistantDelta: () => {}, onError: () => {},
}

beforeEach(() => _resetIdempotencyForTests())

describe('buildRealtimeSessionUpdate — tools + model responses ONLY in the slice', () => {
  it('certified path (no tools): create_response false, no session.tools', () => {
    const u = buildRealtimeSessionUpdate({ pushToTalk: false, listenMode: false, instructions: 'x', voice: 'shimmer' }) as any
    expect(u.session.audio.input.turn_detection.create_response).toBe(false)
    expect(u.session.tools).toBeUndefined()
    expect(u.session.tool_choice).toBeUndefined()
  })
  it('slice path (tools set): create_response true + session.tools + tool_choice auto', () => {
    const u = buildRealtimeSessionUpdate({ pushToTalk: false, listenMode: false, instructions: 'x', voice: 'shimmer', tools: REALTIME_COMM_TOOLS }) as any
    expect(u.session.audio.input.turn_detection.create_response).toBe(true)
    expect(u.session.tools).toHaveLength(REALTIME_COMM_TOOLS.length)
    expect(u.session.tool_choice).toBe('auto')
  })
})

describe('RealtimeVoiceSession — live function-tool journey through the REAL adapter', () => {
  function makeSession() {
    const sent: Array<Record<string, unknown>> = []
    const cards: ActiveActionViewModel[] = []
    const incidents: string[] = []
    const orch = new SessionOrchestrator({ sessionId: 'sess1', kernel: ready })
    const session = new RealtimeVoiceSession(
      noopCbs, 'instructions', undefined, 'quiet', 'he', null,
      (send) => new RealtimeCommController(orch, send, {
        onCard: (vm) => cards.push(vm),
        onIncident: (i) => incidents.push(i.kind),
      }),
    )
    const { receive } = session.injectForTest((e) => sent.push(e))
    return { session, sent, cards, incidents, receive }
  }
  const types = (sent: Array<Record<string, unknown>>) => sent.map((e) => e.type)
  const flush = () => new Promise((r) => setTimeout(r, 0))

  it('the session reports slice mode on', () => {
    expect(makeSession().session.isSliceMode).toBe(true)
  })

  it('a real response.output_item.done(function_call) → card + safe function_call_output + response.create', async () => {
    const { sent, cards, receive } = makeSession()
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_whatsapp', call_id: 'c1', arguments: '{"recipient":"מור","intent":"שיש לי פגישה"}' } })
    await flush()  // let the async onFunctionCall settle

    expect(cards[cards.length-1]?.kind).toBe('message')
    expect(cards[cards.length-1]?.status).toBe('READY_FOR_HANDOFF')
    expect(types(sent)).toEqual(['conversation.item.create', 'response.create'])
    const out = (sent[0] as any).item.output as string
    expect(out).toContain('READY_FOR_HANDOFF')
    expect(out).not.toMatch(/\d{7,}/)              // no phone number ever
  })

  it('response.function_call_arguments.done for a replace → atomic flip to Call', async () => {
    const { sent, cards, receive } = makeSession()
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_whatsapp', call_id: 'c1', arguments: '{"recipient":"מור","intent":"x"}' } })
    await flush()
    receive({ type: 'response.function_call_arguments.done', name: 'replace_active_action', call_id: 'c2', arguments: '{"kind":"call"}' })
    await flush()

    expect(cards[cards.length-1]?.kind).toBe('call')
    expect(cards[cards.length-1]?.supersedes).toBe(cards[0]?.cardId)
    // two tool round-trips (each: item.create + response.create)
    expect(sent.filter((e) => e.type === 'conversation.item.create')).toHaveLength(2)
  })

  it('EXACTLY-ONCE on the real path: the same call in output_item.done + response.done → one card, one output', async () => {
    const { sent, cards, receive } = makeSession()
    const item = { type: 'function_call', name: 'prepare_whatsapp', call_id: 'dup1', arguments: '{"recipient":"מור","intent":"x"}' }
    receive({ type: 'response.output_item.done', item })
    receive({ type: 'response.done', response: { output: [item] } })   // same call, second official shape
    await flush()
    expect(cards.length).toBe(1)
    expect(sent.filter((e) => e.type === 'conversation.item.create')).toHaveLength(1)
  })

  it('a non-function event (audio delta) is ignored by the slice and does not emit tool events', async () => {
    const { sent, cards, receive } = makeSession()
    receive({ type: 'response.output_audio.delta', delta: 'xx' })
    await Promise.resolve()
    expect(cards).toHaveLength(0)
    expect(sent).toHaveLength(0)
  })

  it('a fabricated completion in the model transcript is caught + repaired on the real path', async () => {
    const { sent, incidents, receive } = makeSession()
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_whatsapp', call_id: 'c1', arguments: '{"recipient":"מור","intent":"x"}' } })
    await flush()
    sent.length = 0
    receive({ type: 'response.output_audio_transcript.done', transcript: 'שלחתי למור את ההודעה' })
    expect(incidents).toEqual(['fabricated_completion'])
    expect(sent.some((e) => e.type === 'response.create')).toBe(true)
  })
})
