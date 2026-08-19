/*
 * INDEPENDENT UNKNOWN-FAILURE CAMPAIGN (ADR-0001 §19) — adversarial generalization.
 * ════════════════════════════════════════════════════════════════════════════════
 * These sequences are NOT in the supplied device transcript. They attack the
 * orchestrator's ordering/lifecycle/privacy laws with pathological interleavings to
 * surface unknown failures — replace-before-start, triple recipient/kind flips,
 * cancel-then-late-result, out-of-order turns, fallback↔reconnect churn, a phone
 * number as a recipient, and a throwing kernel. Every one must hold the invariants
 * (one card, monotonic revision, no completion, no number, honest failure) without a crash.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionOrchestrator } from './sessionOrchestrator'
import { _resetIdempotencyForTests, type KernelFn } from './realtimeTools'

const ready: KernelFn = async ({ kind, recipientName }) => ({
  action: recipientName ? 'handoff' : 'clarify', mode: kind, recipientName: recipientName ?? null,
  canHandoff: !!recipientName, status: recipientName ? 'HANDOFF_AVAILABLE' : 'CLARIFY',
})
const throwing: KernelFn = async () => { throw new Error('kernel exploded') }

beforeEach(() => _resetIdempotencyForTests())

describe('adversarial — pathological orderings never break the invariants', () => {
  it('REPLACE before any START does not crash — it starts a fresh action', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a1', kernel: ready })
    const r = await o.acceptTurn({ seq: 1, turnType: 'REPLACE_ACTION', kind: 'call', recipientLabel: 'מור' })
    expect(r.viewModel.cardId).not.toBeNull()
    expect(r.viewModel.kind).toBe('call')
    expect(o.activeCount()).toBe(1)
  })

  it('triple flip message→call→message stays atomic with a monotonic revision each time', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a2', kernel: ready })
    const a = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const b = await o.acceptTurn({ seq: 2, turnType: 'REPLACE_ACTION', kind: 'call' })
    const c = await o.acceptTurn({ seq: 3, turnType: 'REPLACE_ACTION', kind: 'message', intent: 'y' })
    expect([a.viewModel.kind, b.viewModel.kind, c.viewModel.kind]).toEqual(['message', 'call', 'message'])
    expect(b.viewModel.revision).toBeGreaterThan(a.viewModel.revision)
    expect(c.viewModel.revision).toBeGreaterThan(b.viewModel.revision)
    expect(o.activeCount()).toBe(1)          // never two cards
  })

  it('CANCEL then a late TOOL_RESULT is rejected (nothing to render)', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a3', kernel: ready })
    const a = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    o.cancel()
    const late = o.injectToolResult({ forRevision: a.viewModel.revision, generation: 0, status: 'READY_FOR_HANDOFF', kind: 'message', recipientLabel: 'מור' })
    expect(late.rejected).toBe(true)
    expect(o.activeCount()).toBe(0)
  })

  it('an out-of-order (older seq) turn after a newer one is ignored', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a4', kernel: ready })
    await o.acceptTurn({ seq: 5, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const stale = await o.acceptTurn({ seq: 3, turnType: 'REPLACE_ACTION', kind: 'call' })
    expect(stale.viewModel.kind).toBe('message')   // the stale turn did nothing
  })

  it('fallback → reconnect → new turn: two generation bumps, no re-greet, the turn still works', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a5', kernel: ready })
    o.requestGreeting()
    await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    o.enterFallback(); o.reconnect()
    expect(o.requestGreeting()).toBe(false)        // greeting stays once across churn
    const r = await o.acceptTurn({ seq: 2, turnType: 'REPLACE_ACTION', kind: 'call' })
    expect(r.viewModel.kind).toBe('call')
    expect(r.viewModel.status).toBe('READY_FOR_HANDOFF')
  })

  it('a phone number handed in as a recipient label is scrubbed — never rendered, never resolved', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a6', kernel: ready })
    const r = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: '0501234567', intent: 'x' })
    expect(r.viewModel.recipientLabel).toBeNull()
    expect(r.viewModel.status).toBe('NEEDS_CLARIFICATION')   // no number → the kernel asks who
  })

  it('a throwing kernel yields an honest FAILED receipt, not a crash or a fake success', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a7', kernel: throwing })
    const r = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    expect(r.toolReceipt?.status).toBe('FAILED')
    expect(r.viewModel.primaryControl).toBeNull()
    // Even on failure the card can never claim completion.
    for (const bad of ['שלחתי', 'התקשרתי', 'נשלח']) expect(r.viewModel.a11y).not.toContain(bad)
  })

  it('EXPLICIT_SWITCH behaves as an atomic replace (kind + revision change, supersedes set)', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a8', kernel: ready })
    const a = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const b = await o.acceptTurn({ seq: 2, turnType: 'EXPLICIT_SWITCH', kind: 'call' })
    expect(b.viewModel.kind).toBe('call')
    expect(b.viewModel.revision).toBeGreaterThan(a.viewModel.revision)
    expect(b.viewModel.supersedes).toBe(a.viewModel.cardId)
  })

  it('an interruption mid-pending stops playback but preserves the committed card', async () => {
    const o = new SessionOrchestrator({ sessionId: 'a9', kernel: ready })
    const a = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const effects = o.injectInterruption()
    expect(effects.some((e) => e.e === 'STOP_PLAYBACK')).toBe(true)
    expect(o.viewModel().cardId).toBe(a.viewModel.cardId)   // card survives the barge-in
  })
})
