/*
 * ADR-0001 §18 VERTICAL-SLICE FALSIFIER — driven through the headless orchestrator.
 * ════════════════════════════════════════════════════════════════════════════════
 * Proves the exact device-failure journey WITHOUT a mic / WebRTC, by injecting the
 * same events the live RealtimeVoiceSession would emit:
 *   greeting (once) → WhatsApp card in-session → "לא, תתקשרי אליו" atomically REPLACES
 *   the card to Call → session stays live → no 2nd greeting → stale/cross-generation
 *   results never render → no fabricated completion ever speaks → fallback preserves
 *   the active Call action.
 *
 * The orchestrator is the SIMULATED-REALTIME SEAM: one TALK/STATE/TRUTH authority
 * model (control plane = STATE, kernel/tools = TRUTH, monitor = speech guard), driven
 * by injected turns. The kernel is INJECTED so the journey is deterministic.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionOrchestrator } from './sessionOrchestrator'
import { _resetIdempotencyForTests, type KernelFn } from './realtimeTools'

// A controllable kernel mirroring real buildCommunicationAction outputs.
const readyKernel = (canHandoff = true): KernelFn => async ({ kind, recipientName }) => ({
  action: 'handoff', mode: kind, recipientName, canHandoff,
  status: canHandoff ? 'HANDOFF_AVAILABLE' : 'FAILED',
})

beforeEach(() => _resetIdempotencyForTests())

describe('§18 vertical slice — WhatsApp → atomic replace to Call in one live session', () => {
  it('greets exactly once per session', async () => {
    const o = new SessionOrchestrator({ sessionId: 's1', kernel: readyKernel() })
    expect(o.requestGreeting()).toBe(true)   // first greeting fires
    expect(o.requestGreeting()).toBe(false)  // repeated greeting was the device bug
  })

  it('WhatsApp pending → explicit Call ATOMICALLY replaces the card (kind + revision change)', async () => {
    const o = new SessionOrchestrator({ sessionId: 's2', kernel: readyKernel() })
    o.requestGreeting()

    // 1) "תכתבי למור שיש לי פגישה" — WhatsApp start.
    const a = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'שיש לי פגישה מחר' })
    expect(a.viewModel.kind).toBe('message')
    expect(a.viewModel.status).toBe('READY_FOR_HANDOFF')
    expect(a.viewModel.visible).toBe(true)
    expect(a.viewModel.recipientLabel).toBe('מור')
    const rev1 = a.viewModel.revision
    const card1 = a.viewModel.cardId

    // 2) "לא, תתקשרי אליו" — explicit REPLACE to a call for the SAME recipient.
    const b = await o.acceptTurn({ seq: 2, turnType: 'REPLACE_ACTION', kind: 'call' })
    expect(b.viewModel.kind).toBe('call')                 // atomically flipped
    expect(b.viewModel.status).toBe('READY_FOR_HANDOFF')
    expect(b.viewModel.recipientLabel).toBe('מור')        // recipient carried
    expect(b.viewModel.revision).toBeGreaterThan(rev1)    // monotonic revision
    expect(b.viewModel.cardId).not.toBe(card1)            // a new committed action
    expect(b.viewModel.supersedes).toBe(card1)            // it superseded the WhatsApp card
    expect(o.activeCount()).toBe(1)                        // exactly ONE visible action
  })

  it('MUTATION guard: a reducer that treated REPLACE as CONTINUE would keep message — proven by kind+revision', async () => {
    const o = new SessionOrchestrator({ sessionId: 's3', kernel: readyKernel() })
    await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const b = await o.acceptTurn({ seq: 2, turnType: 'REPLACE_ACTION', kind: 'call' })
    // If replace had been mis-handled as continue, kind would still be 'message'.
    expect(b.viewModel.kind).toBe('call')
  })

  it('a stale TOOL_RESULT for an old revision never renders (laws 5/6/12)', async () => {
    const o = new SessionOrchestrator({ sessionId: 's4', kernel: readyKernel() })
    const a = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const committedRev = a.viewModel.revision
    const r = o.injectToolResult({ forRevision: committedRev - 1, generation: 0, status: 'READY_FOR_HANDOFF', kind: 'call', recipientLabel: 'אחר' })
    expect(r.rejected).toBe(true)
    expect(o.viewModel().recipientLabel).toBe('מור')  // unchanged
    expect(o.viewModel().kind).toBe('message')
  })

  it('a general question or complaint never mutates the pending action (laws 13/14)', async () => {
    const o = new SessionOrchestrator({ sessionId: 's5', kernel: readyKernel() })
    await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const c = await o.acceptTurn({ seq: 2, turnType: 'COMPLAINT' })
    expect(c.viewModel.kind).toBe('message')      // still the WhatsApp action
    expect(c.viewModel.status).toBe('READY_FOR_HANDOFF')
    expect(o.activeCount()).toBe(1)
  })

  it('speech guard: a fabricated completion is blocked; truthful preparation passes', async () => {
    const o = new SessionOrchestrator({ sessionId: 's6', kernel: readyKernel() })
    await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const bad = o.guardSpeech('שלחתי למור את ההודעה')
    expect(bad.allowed).toBe(false)
    expect(bad.safeText).not.toContain('שלחתי')
    const good = o.guardSpeech('מכינה לך את ההודעה למור, לחצי כדי לפתוח בוואטסאפ')
    expect(good.allowed).toBe(true)
    expect(good.safeText).toContain('מכינה')
  })

  it('fallback preserves the active Call action and rejects a pre-fallback (stale generation) result', async () => {
    const o = new SessionOrchestrator({ sessionId: 's7', kernel: readyKernel() })
    o.requestGreeting()
    await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const b = await o.acceptTurn({ seq: 2, turnType: 'REPLACE_ACTION', kind: 'call' })
    const rev = b.viewModel.revision

    o.enterFallback()
    // The Call action survives the transport switch…
    expect(o.viewModel().kind).toBe('call')
    expect(o.viewModel().visible).toBe(true)
    // …no re-greeting on fallback…
    expect(o.requestGreeting()).toBe(false)
    // …and a late result from the pre-fallback generation is rejected.
    const late = o.injectToolResult({ forRevision: rev, generation: 0, status: 'READY_FOR_HANDOFF', kind: 'call', recipientLabel: 'מור' })
    expect(late.rejected).toBe(true)
  })

  it('no completion status is ever representable in a view model', async () => {
    const o = new SessionOrchestrator({ sessionId: 's8', kernel: readyKernel() })
    const a = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    // The card can only ever be a preparation/handoff state — never sent/called/dialed.
    expect(['NEEDS_CLARIFICATION', 'READY_FOR_HANDOFF', 'NOT_CONFIGURED', 'CANCELLED', 'FAILED']).toContain(a.viewModel.status)
  })

  it('an unresolved recipient yields a clarification card, not a guessed handoff', async () => {
    const o = new SessionOrchestrator({ sessionId: 's9', kernel: readyKernel(false) })
    const a = await o.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מישהו', intent: 'x' })
    expect(a.viewModel.status).toBe('NOT_CONFIGURED')
    expect(a.viewModel.primaryControl).toBeNull()  // no handoff button when not configured
  })
})
