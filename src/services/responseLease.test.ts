/*
 * §B response ownership — through the REAL RealtimeVoiceSession path (injectForTest).
 * Every response.create funnels through sendEvent → createResponse → the per-turn
 * lease. Two response.create for one logical turn yield ONE wire event; a new
 * accepted user transcript begins a new turn (one more response); a duplicate
 * transcript shape does not grant a second response.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { RealtimeVoiceSession } from './realtimeVoice'
import { RealtimeCommController } from '../screens/AbuAI/realtime/realtimeCommController'
import { SessionOrchestrator } from '../screens/AbuAI/realtime/sessionOrchestrator'
import { _resetIdempotencyForTests, type KernelFn } from '../screens/AbuAI/realtime/realtimeTools'

const ready: KernelFn = async ({ kind, recipientName }) => ({
  action: recipientName ? 'handoff' : 'clarify', mode: kind, recipientName: recipientName ?? null,
  canHandoff: !!recipientName, status: recipientName ? 'HANDOFF_AVAILABLE' : 'CLARIFY',
})
const noopCbs = { onStateChange: () => {}, onUserTranscript: () => {}, onAssistantTranscript: () => {}, onAssistantDelta: () => {}, onError: () => {} }
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => _resetIdempotencyForTests())

function make() {
  const sent: Array<Record<string, unknown>> = []
  const orch = new SessionOrchestrator({ sessionId: 's', kernel: ready })
  const session = new RealtimeVoiceSession(
    noopCbs, 'i', undefined, 'quiet', 'he', null,
    (send) => new RealtimeCommController(orch, send, { onCard: () => {} }),
  )
  const { receive } = session.injectForTest((e) => sent.push(e))
  return { sent, receive }
}
const responses = (sent: Array<Record<string, unknown>>) => sent.filter((e) => e.type === 'response.create').length

describe('§B — one response.create per logical turn through the real session', () => {
  it('two function-call response.create in ONE turn → exactly one response.create on the wire', async () => {
    const { sent, receive } = make()
    receive({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'תתקשרי למור', item_id: 'u1' })
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_call', call_id: 'c1', arguments: '{"recipient":"מור"}' } })
    await flush()
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_whatsapp', call_id: 'c2', arguments: '{"recipient":"מור","intent":"x"}' } })
    await flush()
    expect(responses(sent)).toBe(1)                                   // second response.create REJECTED (dup audio)
  })

  it('a NEW accepted transcript begins a new turn → one more response is allowed', async () => {
    const { sent, receive } = make()
    receive({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'a', item_id: 'u1' })
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_call', call_id: 'c1', arguments: '{"recipient":"מור"}' } })
    await flush()
    receive({ type: 'response.done', response: {} })                  // response lifecycle ends → lease released
    receive({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'b', item_id: 'u2' })
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_call', call_id: 'c3', arguments: '{"recipient":"מור"}' } })
    await flush()
    expect(responses(sent)).toBe(2)                                   // one per turn
  })

  it('a DUPLICATE transcript shape does not grant a second response for the same turn', async () => {
    const { sent, receive } = make()
    receive({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'x', item_id: 'u1' })
    receive({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'x', item_id: 'u1' }) // duplicate shape
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_call', call_id: 'c1', arguments: '{"recipient":"מור"}' } })
    await flush()
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_whatsapp', call_id: 'c2', arguments: '{"recipient":"מור","intent":"x"}' } })
    await flush()
    expect(responses(sent)).toBe(1)                                   // still one turn → one response
  })
})
