/*
 * DESTRUCTIVE / MUTATION QA SWEEP (ADR-0001 §5/§7/§12/§13) — attacks the REAL
 * production adapter chain, not the happy path:
 *   RealtimeCommController → SessionOrchestrator → control-plane reducer + kernel
 *   dispatch (dispatchTool) → canonical ActiveActionViewModel → truth monitor.
 *
 * Every test is a hostile sequence targeting a specific invariant the mission
 * named (stale/generation rejection, exactly-once across async, replace/cancel
 * WHILE a tool result is in flight, privacy of args/receipts, safe-label vs
 * local-phone resolution, fallback/reconnect not reviving cancelled actions,
 * greeting-once across reconnect, one canonical projection). Each is written so a
 * plausible source MUTATION (flip a comparison, drop a guard, widen a match)
 * makes it RED — noted inline as "MUTATION-CATCH".
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { SessionOrchestrator } from './sessionOrchestrator'
import { RealtimeCommController } from './realtimeCommController'
import { extractFunctionCall } from './realtimeFunctionBridge'
import { dispatchTool, _resetIdempotencyForTests, type KernelFn } from './realtimeTools'
import { monitorUtterance } from './truthMonitor'

const ready: KernelFn = async ({ kind, recipientName }) => ({
  action: recipientName ? 'handoff' : 'clarify', mode: kind, recipientName: recipientName ?? null,
  canHandoff: !!recipientName, status: recipientName ? 'HANDOFF_AVAILABLE' : 'CLARIFY',
})

/** A kernel whose FIRST invocation blocks on a gate — lets a test hold one call
 *  "in flight" while another turn mutates state. */
function gatedKernel() {
  let calls = 0
  let release!: () => void
  const gate = new Promise<void>((r) => { release = r })
  const kernel: KernelFn = async ({ kind, recipientName }) => {
    calls += 1
    if (calls === 1) await gate
    return { action: 'handoff', mode: kind, recipientName: recipientName ?? null, canHandoff: true, status: 'HANDOFF_AVAILABLE' }
  }
  return { kernel, release: () => release(), calls: () => calls }
}

beforeEach(() => _resetIdempotencyForTests())

// ─── Stale / generation / revision rejection ─────────────────────────────────
describe('control-plane stale rejection under hostile ordering', () => {
  it('a pre-fallback (old generation) tool result is REJECTED and never overwrites the live card', async () => {
    const orch = new SessionOrchestrator({ sessionId: 's-gen', kernel: ready })
    const first = await orch.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    expect(first.viewModel.status).toBe('READY_FOR_HANDOFF')
    expect(first.viewModel.generation).toBe(0)
    orch.enterFallback() // generation → 1
    // A late realtime event from generation 0 tries to rewrite the recipient.
    const late = orch.injectToolResult({ forRevision: 1, generation: 0, status: 'READY_FOR_HANDOFF', kind: 'message', recipientLabel: 'מישהו אחר' })
    expect(late.rejected).toBe(true)                       // MUTATION-CATCH: drop the generation check → false
    expect(orch.viewModel().recipientLabel).toBe('מור')    // not overwritten by the stale event
  })

  it('after a REPLACE bumps the revision, a result for the OLD revision is rejected', async () => {
    const orch = new SessionOrchestrator({ sessionId: 's-rev', kernel: ready })
    await orch.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'message', recipientLabel: 'מור', intent: 'x' })
    const replaced = await orch.acceptTurn({ seq: 2, turnType: 'REPLACE_ACTION', kind: 'call', recipientLabel: 'מור', intent: '' })
    expect(replaced.viewModel.kind).toBe('call')
    expect(replaced.viewModel.revision).toBe(2)
    const old = orch.injectToolResult({ forRevision: 1, generation: 0, status: 'READY_FOR_HANDOFF', kind: 'message', recipientLabel: 'מור' })
    expect(old.rejected).toBe(true)                        // MUTATION-CATCH: forRevision !== active.revision guard
    expect(orch.viewModel().kind).toBe('call')             // the message revision cannot resurrect
  })
})

// ─── Fallback / reconnect must not revive a cancelled action; greeting-once ───
describe('fallback / reconnect recovery invariants', () => {
  it('a delayed result for a CANCELLED action never revives it, even across fallback+reconnect', async () => {
    const orch = new SessionOrchestrator({ sessionId: 's-cxl', kernel: ready })
    await orch.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'call', recipientLabel: 'מור', intent: '' })
    orch.cancel()
    expect(orch.activeCount()).toBe(0)
    orch.enterFallback(); orch.reconnect()
    const delayed = orch.injectToolResult({ forRevision: 1, generation: 0, status: 'READY_FOR_HANDOFF', kind: 'call', recipientLabel: 'מור' })
    expect(delayed.rejected).toBe(true)                    // MUTATION-CATCH: !s.active guard in TOOL_RESULT
    expect(orch.viewModel().visible).toBe(false)
    expect(orch.activeCount()).toBe(0)
  })

  it('greeting fires exactly once — never again after reconnect (law 8)', () => {
    const orch = new SessionOrchestrator({ sessionId: 's-greet', kernel: ready })
    expect(orch.requestGreeting()).toBe(true)
    expect(orch.requestGreeting()).toBe(false)
    orch.enterFallback(); orch.reconnect()
    expect(orch.requestGreeting()).toBe(false)             // MUTATION-CATCH: reset greetingEmitted on reconnect
  })
})

// ─── Replace / cancel WHILE a tool result is in flight (real async race) ──────
describe('mutation WHILE a tool result is in flight', () => {
  it('CANCEL during an in-flight prepare → the prepare result is rejected, card not revived', async () => {
    const g = gatedKernel()
    const sent: Array<Record<string, unknown>> = []
    const orch = new SessionOrchestrator({ sessionId: 's-inflight-cancel', kernel: g.kernel })
    const ctl = new RealtimeCommController(orch, (e) => sent.push(e), { onCard: () => {} })
    const p = ctl.onFunctionCall({ name: 'prepare_whatsapp', callId: 'c1', argsJson: '{"recipient":"מור","intent":"x"}' })
    // While c1 is parked in the kernel, a cancel arrives (no kernel round-trip).
    const c = await ctl.onFunctionCall({ name: 'cancel_active_action', callId: 'c2', argsJson: '{}' })
    expect(c.visible).toBe(false)
    g.release()
    await p
    expect(orch.viewModel().visible).toBe(false)           // MUTATION-CATCH: stale result would revive the card
    expect(orch.activeCount()).toBe(0)
  })

  it('REPLACE during an in-flight prepare → latest intent (call) wins, old (message) result rejected', async () => {
    const g = gatedKernel()
    const orch = new SessionOrchestrator({ sessionId: 's-inflight-replace', kernel: g.kernel })
    const ctl = new RealtimeCommController(orch, () => {}, { onCard: () => {} })
    const p = ctl.onFunctionCall({ name: 'prepare_whatsapp', callId: 'c1', argsJson: '{"recipient":"מור","intent":"x"}' })
    const replaced = await ctl.onFunctionCall({ name: 'replace_active_action', callId: 'c2', argsJson: '{"kind":"call"}' })
    expect(replaced.kind).toBe('call')
    expect(replaced.revision).toBe(2)
    g.release()
    await p
    const vm = orch.viewModel()
    expect(vm.kind).toBe('call')                           // latest intent wins
    expect(vm.revision).toBe(2)
    expect(vm.status).toBe('READY_FOR_HANDOFF')
    expect(vm.recipientLabel).toBe('מור')                  // recipient carried across the replace
    expect(orch.activeCount()).toBe(1)
  })
})

// ─── Exactly-once across duplicate / delayed / reordered completion events ────
describe('exactly-once across duplicate + reordered Realtime completion shapes', () => {
  it('the SAME call arriving as output_item.done THEN (later) response.done → one card, one receipt', async () => {
    const sent: Array<Record<string, unknown>> = []
    const cards: unknown[] = []
    const orch = new SessionOrchestrator({ sessionId: 's-dup', kernel: ready })
    const ctl = new RealtimeCommController(orch, (e) => sent.push(e), { onCard: (vm) => cards.push(vm) })
    const shapeA = extractFunctionCall({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_call', call_id: 'dup1', arguments: '{"recipient":"מור"}' } })!
    const shapeB = extractFunctionCall({ type: 'response.done', response: { output: [{ type: 'function_call', name: 'prepare_call', call_id: 'dup1', arguments: '{"recipient":"מור"}' }] } })!
    expect(shapeA.callId).toBe('dup1'); expect(shapeB.callId).toBe('dup1')
    await ctl.onFunctionCall(shapeA)
    await ctl.onFunctionCall(shapeB)                       // delayed duplicate of the SAME call id
    expect(cards.length).toBe(1)                           // MUTATION-CATCH: drop the handled-cache → 2 cards
    expect(sent.filter((e) => e.type === 'conversation.item.create').length).toBe(1)
    expect(orch.viewModel().revision).toBe(1)
  })
})

// ─── Privacy: numbers never leave the kernel via args, receipts or the model ──
describe('privacy by construction under hostile inputs', () => {
  it('a phone number in tool args never resolves and never appears in the function_call_output', async () => {
    const sent: Array<Record<string, unknown>> = []
    const orch = new SessionOrchestrator({ sessionId: 's-priv', kernel: ready })
    const ctl = new RealtimeCommController(orch, (e) => sent.push(e), { onCard: () => {} })
    const vm = await ctl.onFunctionCall({ name: 'prepare_whatsapp', callId: 'p1', argsJson: '{"recipient":"מור 0501234567","intent":"x"}' })
    expect(vm.status).toBe('NEEDS_CLARIFICATION')          // stripped label cannot resolve
    expect(vm.recipientLabel).toBeNull()
    const output = sent.filter((e) => e.type === 'conversation.item.create')
      .map((e) => (e as { item: { output: string } }).item.output).join(' ')
    expect(output).not.toMatch(/\d{7,}/)                   // MUTATION-CATCH: weaken scrubLabel digit gate
  })

  it('dispatchTool refuses a number in args (FAILED, provenance control-plane, null label)', async () => {
    const receipt = await dispatchTool(
      { name: 'prepare_call', args: { recipient: '0501234567', intent: 'x' } },
      { sessionId: 's', turnId: 't', actionId: 'a', toolCallId: 'tc', generation: 0, revision: 1, idempotencyKey: 's:a:1' },
      ready,
    )
    expect(receipt.status).toBe('FAILED')
    expect(receipt.recipientLabel).toBeNull()
    expect(receipt.reason).toBe('phone-in-args-forbidden')
  })
})

// ─── One canonical projection: card, receipt and speech read the same revision ─
describe('single canonical projection (law 9) agrees across surfaces', () => {
  it('a READY call projects a matching primaryControl + a11y that never asserts completion', async () => {
    const orch = new SessionOrchestrator({ sessionId: 's-proj', kernel: ready })
    const out = await orch.acceptTurn({ seq: 1, turnType: 'START_ACTION', kind: 'call', recipientLabel: 'מור', intent: '' })
    const vm = out.viewModel
    expect(vm.status).toBe('READY_FOR_HANDOFF')
    expect(vm.primaryControl).toBe('התקשרי')
    expect(vm.a11y).toContain('לא מחייג לבד')             // truthful: does NOT dial by itself
    // The receipt the model gets must itself pass the truth monitor (no self-tripping).
    expect(monitorUtterance(vm.a11y, { status: vm.status }).ok).toBe(true)
    // Card revision == receipt revision (one committed source).
    expect(vm.revision).toBe(out.toolReceipt?.revision)   // MUTATION-CATCH: divergent card/receipt revision
  })
})

// ─── Truth-monitor mutation sentinels (person / negation / narrow-match) ──────
describe('truth-monitor mutation sentinels', () => {
  it('negation handling: negated completions stay truthful (remove-NEG mutation → red)', () => {
    for (const u of ['לא שלחתי עדיין', 'לא דיברתי עם מור', 'ההודעה עדיין לא נשלחה']) {
      expect(monitorUtterance(u, { status: 'READY_FOR_HANDOFF' }).ok, u).toBe(true)
    }
  })
  it('person handling: a 2nd-person question is not a 1st-person completion (add-שלחת mutation → red)', () => {
    expect(monitorUtterance('כבר שלחת לו?', null).ok).toBe(true)
  })
  it('narrow-match guard: a ready-call denial with "לחייג" IS caught (drop-חייג mutation → red)', () => {
    expect(monitorUtterance('אני לא יכולה לחייג לו', { status: 'READY_FOR_HANDOFF' }).ok).toBe(false)
  })
  it('real fabrication still fails hard (widen-to-nothing mutation → red)', () => {
    expect(monitorUtterance('שלחתי את ההודעה', { status: 'READY_FOR_HANDOFF' }).ok).toBe(false)
  })
})
