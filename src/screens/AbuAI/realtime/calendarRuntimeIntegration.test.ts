/*
 * CAL-RUNTIME-INTEGRATION — the runtime reachability + owner proof.
 * ════════════════════════════════════════════════════════════════════════════
 * Drives an ACTUAL RealtimeVoiceSession through its REAL handleEvent → controller
 * → sendEvent path (injectForTest, no mic), proving a completed CALENDAR function
 * call reaches the canonical draft controller AT PARITY with communication, and
 * that routing is isolated (comm↔calendar disjoint). Failing-first before the
 * session routes calendar tools.
 */
import { describe, it, expect } from 'vitest'
import { RealtimeVoiceSession } from '../../../services/realtimeVoice'
import { RealtimeCommController } from './realtimeCommController'
import { CalendarDraftController } from './calendarDraftController'
import { SessionOrchestrator } from './sessionOrchestrator'
import { _resetIdempotencyForTests, type KernelFn } from './realtimeTools'
import { type RelationshipResolver } from './calendarDraft'

const ready: KernelFn = async ({ kind, recipientName }) => ({
  action: recipientName ? 'handoff' : 'clarify', mode: kind, recipientName: recipientName ?? null,
  canHandoff: !!recipientName, status: recipientName ? 'HANDOFF_AVAILABLE' : 'CLARIFY',
})
const resolve: RelationshipResolver = (p) => (p.trim() === 'מור' ? 'מור' : null)
const noopCbs = { onStateChange: () => {}, onUserTranscript: () => {}, onAssistantTranscript: () => {}, onAssistantDelta: () => {}, onError: () => {} }
const flush = () => new Promise((r) => setTimeout(r, 0))

function makeSession() {
  _resetIdempotencyForTests()
  const sent: Array<Record<string, unknown>> = []
  const commCards: Array<{ kind: string }> = []
  const calCards: Array<{ confirmation: string; date: string | null; participant: string | null }> = []
  const orch = new SessionOrchestrator({ sessionId: 'sess', kernel: ready })
  const session = new RealtimeVoiceSession(
    noopCbs, 'instructions', undefined, 'quiet', 'he', null,
    (send) => new RealtimeCommController(orch, send, { onCard: (vm) => commCards.push({ kind: vm.kind }) }),
    (send) => new CalendarDraftController(resolve, send, { onCard: (r) => calCards.push({ confirmation: r.confirmation, date: r.date, participant: r.participant }) }),
  )
  const { receive } = session.injectForTest((e) => sent.push(e))
  return { sent, commCards, calCards, receive }
}

describe('CAL-RUNTIME-INTEGRATION — calendar reaches the draft through the REAL session', () => {
  it('a completed prepare_calendar_event routes to the canonical draft controller (PRODUCTION_ADAPTER)', async () => {
    const { sent, calCards, receive } = makeSession()
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_calendar_event', call_id: 'k1', arguments: '{"title":"רופא שיניים","date":"2026-08-10","time":"15:00","participant":"מור"}' } })
    await flush()
    expect(calCards.length).toBe(1)
    expect(calCards[0]!.confirmation).toBe('AWAITING_CONFIRM')
    expect(calCards[0]!.date).toBe('2026-08-10')       // grounded — real date, never "מחר"
    expect(calCards[0]!.participant).toBe('מור')
    // The model got a safe function_call_output + a response.create (never a relative date).
    expect(sent.map((e) => e.type)).toEqual(['conversation.item.create', 'response.create'])
    const out = (sent[0] as { item: { output: string } }).item.output
    expect(out).not.toMatch(/מחר|tomorrow/i)
  })

  it('ISOLATION: a communication tool is NOT routed to Calendar, and vice-versa', async () => {
    const { commCards, calCards, receive } = makeSession()
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_call', call_id: 'c1', arguments: '{"recipient":"מור"}' } })
    await flush()
    expect(commCards.length).toBe(1); expect(calCards.length).toBe(0)   // comm → comm only
    receive({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_calendar_event', call_id: 'k1', arguments: '{"title":"קפה","date":"2026-08-12"}' } })
    await flush()
    expect(calCards.length).toBe(1); expect(commCards.length).toBe(1)   // calendar → calendar only (comm unchanged)
  })

  it('EXACTLY-ONCE on the real path: the same calendar call in two shapes → one draft, one output', async () => {
    const { sent, calCards, receive } = makeSession()
    const item = { type: 'function_call', name: 'prepare_calendar_event', call_id: 'dup', arguments: '{"title":"רופא","date":"2026-08-10"}' }
    receive({ type: 'response.output_item.done', item })
    receive({ type: 'response.done', response: { output: [item] } })
    await flush()
    expect(calCards.length).toBe(1)
    expect(sent.filter((e) => e.type === 'conversation.item.create')).toHaveLength(1)
  })
})
