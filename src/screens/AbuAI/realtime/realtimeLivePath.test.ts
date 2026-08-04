/*
 * LIVE REALTIME FUNCTION-TOOL PATH (ADR-0001 §12) — production-faithful, no mic.
 * ═══════════════════════════════════════════════════════════════════════════════
 * Drives the REAL adapter chain the live WebRTC session uses:
 *   raw server event ─► extractFunctionCall ─► RealtimeCommController ─► SessionOrchestrator
 *     (control plane + kernel) ─► conversation.item.create(function_call_output) + response.create
 * with an INJECTED send (captures the exact events the data channel would carry) and an
 * injected kernel. Proves the §18 journey through the function-call seam, privacy of the
 * receipt returned to the model, idempotency by call id, and the streaming truth guard.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { extractFunctionCall, safeParseArgs, isKnownToolCall } from './realtimeFunctionBridge'
import { REALTIME_COMM_TOOLS, REALTIME_TOOL_NAMES, isRealtimeToolName } from '../../../services/realtimeToolSchemas'
import { RealtimeCommController } from './realtimeCommController'
import { SessionOrchestrator } from './sessionOrchestrator'
import { monitorUtterance } from './truthMonitor'
import { _resetIdempotencyForTests, type KernelFn } from './realtimeTools'

const ready: KernelFn = async ({ kind, recipientName }) => ({
  action: recipientName ? 'handoff' : 'clarify', mode: kind, recipientName: recipientName ?? null,
  canHandoff: !!recipientName, status: recipientName ? 'HANDOFF_AVAILABLE' : 'CLARIFY',
})

beforeEach(() => _resetIdempotencyForTests())

// ─── The tool schemas ───────────────────────────────────────────────────────
describe('realtime tool schemas — privacy by construction', () => {
  it('exposes exactly the four comm tools, all function-typed', () => {
    expect(REALTIME_TOOL_NAMES.sort()).toEqual(['cancel_active_action', 'prepare_call', 'prepare_whatsapp', 'replace_active_action'])
    for (const t of REALTIME_COMM_TOOLS) expect(t.type).toBe('function')
    expect(isRealtimeToolName('prepare_call')).toBe(true)
    expect(isRealtimeToolName('send_money')).toBe(false)
  })
  it('NO tool parameter KEY is a phone/number field (descriptions may still instruct "never a number")', () => {
    for (const t of REALTIME_COMM_TOOLS) {
      for (const key of Object.keys(t.parameters.properties)) {
        expect(key.toLowerCase()).not.toMatch(/phone|number|e164|tel|טלפון|מספר/)
      }
      // recipient params are documented as NAMES, and the schema forbids extra fields.
      expect(t.parameters.additionalProperties).toBe(false)
    }
    // The recipient description positively tells the model to pass a name, never a number.
    const recipientTool = REALTIME_COMM_TOOLS.find((t) => 'recipient' in t.parameters.properties)!
    expect(recipientTool.parameters.properties.recipient!.description).toMatch(/NAME|name/)
  })
})

// ─── The event parser ────────────────────────────────────────────────────────
describe('extractFunctionCall — parses both official completion shapes, ignores the rest', () => {
  it('response.function_call_arguments.done', () => {
    const fc = extractFunctionCall({ type: 'response.function_call_arguments.done', name: 'prepare_call', call_id: 'c1', arguments: '{"recipient":"מור"}' })
    expect(fc).toEqual({ name: 'prepare_call', callId: 'c1', argsJson: '{"recipient":"מור"}' })
  })
  it('response.output_item.done with a function_call item', () => {
    const fc = extractFunctionCall({ type: 'response.output_item.done', item: { type: 'function_call', name: 'prepare_whatsapp', call_id: 'c2', arguments: '{}' } })
    expect(fc?.name).toBe('prepare_whatsapp'); expect(fc?.callId).toBe('c2')
  })
  it('response.done scans output for a function_call item', () => {
    const fc = extractFunctionCall({ type: 'response.done', response: { output: [{ type: 'message' }, { type: 'function_call', name: 'cancel_active_action', call_id: 'c3', arguments: '{}' }] } })
    expect(fc?.name).toBe('cancel_active_action')
  })
  it('ignores audio/text/delta events and malformed items', () => {
    expect(extractFunctionCall({ type: 'response.output_audio.delta', delta: 'x' })).toBeNull()
    expect(extractFunctionCall({ type: 'response.output_item.done', item: { type: 'message' } })).toBeNull()
    expect(extractFunctionCall({ type: 'response.function_call_arguments.delta', call_id: 'c', delta: '{' })).toBeNull()
    expect(extractFunctionCall(null)).toBeNull()
  })
  it('safeParseArgs never throws; isKnownToolCall gates drift', () => {
    expect(safeParseArgs('not json')).toEqual({})
    expect(safeParseArgs('{"a":1}')).toEqual({ a: 1 })
    expect(isKnownToolCall({ name: 'prepare_call', callId: 'x', argsJson: '{}' })).toBe(true)
    expect(isKnownToolCall({ name: 'wire_transfer', callId: 'x', argsJson: '{}' })).toBe(false)
  })
})

// ─── The live controller ─────────────────────────────────────────────────────
describe('RealtimeCommController — the live function-tool journey (§18) through the real seam', () => {
  function make() {
    const sent: Array<Record<string, unknown>> = []
    const cards: Array<{ kind: string; status: string; revision: number }> = []
    const incidents: Array<{ kind: string }> = []
    const orch = new SessionOrchestrator({ sessionId: 'live1', kernel: ready })
    const ctl = new RealtimeCommController(orch, (e) => sent.push(e), {
      onCard: (vm) => cards.push({ kind: vm.kind, status: vm.status, revision: vm.revision }),
      onIncident: (i) => incidents.push({ kind: i.kind }),
    })
    return { sent, cards, incidents, orch, ctl }
  }
  const fcOutputs = (sent: Array<Record<string, unknown>>) =>
    sent.filter((e) => e.type === 'conversation.item.create').map((e) => (e as { item: { output: string } }).item.output)

  it('prepare_whatsapp → READY card + a SAFE function_call_output + response.create', async () => {
    const { sent, cards, ctl } = make()
    const vm = await ctl.onFunctionCall({ name: 'prepare_whatsapp', callId: 'c1', argsJson: '{"recipient":"מור","intent":"שיש לי פגישה"}' })
    expect(vm.kind).toBe('message'); expect(vm.status).toBe('READY_FOR_HANDOFF')
    expect(cards).toEqual([{ kind: 'message', status: 'READY_FOR_HANDOFF', revision: 1 }])
    // The model got exactly: function_call_output then response.create.
    expect(sent.map((e) => e.type)).toEqual(['conversation.item.create', 'response.create'])
    const out = fcOutputs(sent)[0]!
    expect(out).toContain('READY_FOR_HANDOFF')
    expect(out).toContain('מור')
    // Never a first-person completion, never a number, and — crucially — the receipt we
    // hand the model must PASS our own truth monitor (no self-tripping false grounding).
    for (const bad of ['שלחתי', 'התקשרתי', 'חייגתי']) expect(out).not.toContain(bad)
    expect(out).not.toMatch(/\d{7,}/)
    expect(monitorUtterance(out, { status: 'READY_FOR_HANDOFF' }).ok).toBe(true)
  })

  it('replace_active_action atomically flips the live card message → call (rev up, supersedes)', async () => {
    const { cards, ctl } = make()
    const a = await ctl.onFunctionCall({ name: 'prepare_whatsapp', callId: 'c1', argsJson: '{"recipient":"מור","intent":"x"}' })
    const b = await ctl.onFunctionCall({ name: 'replace_active_action', callId: 'c2', argsJson: '{"kind":"call"}' })
    expect(b.kind).toBe('call')
    expect(b.revision).toBeGreaterThan(a.revision)
    expect(b.supersedes).toBe(a.cardId)
    expect(cards.map((c) => c.kind)).toEqual(['message', 'call'])
    expect(ctl.viewModel().recipientLabel).toBe('מור')  // recipient carried
  })

  it('a duplicate model call id is idempotent — no second card, receipt re-sent', async () => {
    const { sent, cards, ctl } = make()
    await ctl.onFunctionCall({ name: 'prepare_call', callId: 'dup', argsJson: '{"recipient":"מור"}' })
    const before = cards.length
    await ctl.onFunctionCall({ name: 'prepare_call', callId: 'dup', argsJson: '{"recipient":"מור"}' })
    expect(cards.length).toBe(before)                     // NO second card
    // The receipt was re-sent (idempotent) but no new action was created.
    expect(sent.filter((e) => e.type === 'conversation.item.create').length).toBe(2)
    expect(ctl.viewModel().revision).toBe(1)              // revision did not advance
  })

  it('a phone number in the args never resolves and never appears in the receipt', async () => {
    const { sent, ctl } = make()
    const vm = await ctl.onFunctionCall({ name: 'prepare_whatsapp', callId: 'c1', argsJson: '{"recipient":"0501234567","intent":"x"}' })
    expect(vm.status).toBe('NEEDS_CLARIFICATION')
    expect(vm.recipientLabel).toBeNull()
    expect(fcOutputs(sent)[0]!).not.toMatch(/\d{7,}/)
  })

  it('cancel_active_action clears the live card', async () => {
    const { ctl } = make()
    await ctl.onFunctionCall({ name: 'prepare_whatsapp', callId: 'c1', argsJson: '{"recipient":"מור","intent":"x"}' })
    const c = await ctl.onFunctionCall({ name: 'cancel_active_action', callId: 'c2', argsJson: '{}' })
    expect(c.visible).toBe(false)
  })

  it('streaming truth guard: a fabricated completion is caught + repaired; truthful prep passes', async () => {
    const { sent, incidents, ctl } = make()
    await ctl.onFunctionCall({ name: 'prepare_whatsapp', callId: 'c1', argsJson: '{"recipient":"מור","intent":"x"}' })
    sent.length = 0
    const bad = ctl.onAssistantTranscript('שלחתי למור את ההודעה')
    expect(bad.ok).toBe(false)
    expect(incidents).toEqual([{ kind: 'fabricated_completion' }])
    // A truthful repair is issued on the next turn.
    expect(sent.some((e) => e.type === 'response.create')).toBe(true)
    const good = ctl.onAssistantTranscript('מכינה לך את ההודעה למור, תלחצי כדי לפתוח')
    expect(good.ok).toBe(true)
  })
})
