/*
 * REALTIME TOOL DISPATCH — the delegating adapter (ADR-0001 §5/§7).
 *
 * The Realtime model may REQUEST an action via a function tool; it may not decide
 * it. Every tool call is DELEGATED to the deterministic Communication kernel
 * (buildCommunicationAction) and mapped to a typed receipt. The dispatcher owns no
 * semantics: it validates, delegates, maps status, enforces privacy + idempotency,
 * and structurally forbids any completion claim.
 *
 * The kernel is INJECTED (KernelFn) so this is unit-testable without the live
 * adapter/contacts; production supplies a thin adapter over buildCommunicationAction.
 */

export type ToolName = 'prepare_whatsapp' | 'prepare_call' | 'replace_active_action' | 'cancel_active_action'
export type Kind = 'call' | 'message'

// NO completion status exists (SENT/CALLED/DIALED/DELIVERED are unrepresentable).
export type ReceiptStatus = 'NEEDS_CLARIFICATION' | 'READY_FOR_HANDOFF' | 'NOT_CONFIGURED' | 'CANCELLED' | 'FAILED'

export interface ToolCall {
  name: ToolName
  args: { recipient?: string | null; intent?: string; kind?: Kind }
}
export interface ToolContext {
  sessionId: string; turnId: string; actionId: string; toolCallId: string
  generation: number; revision: number; idempotencyKey: string
}
export interface ToolReceipt {
  status: ReceiptStatus
  kind: Kind
  recipientLabel: string | null           // safe name — NEVER a phone number
  revision: number
  generation: number
  correlation: { sessionId: string; turnId: string; actionId: string; toolCallId: string }
  provenance: 'contacts-kernel' | 'control-plane'
  allowedClaims: string[]                  // permitted spoken meaning (never a completion)
  reason?: string
}

/** Minimal structural view of the kernel result — decouples from the full type. */
export interface KernelActionResult { action: 'handoff' | 'clarify'; mode: Kind; recipientName: string | null; canHandoff: boolean; status: string }
export type KernelFn = (input: { kind: Kind; recipientName: string | null; intent: string }) => Promise<KernelActionResult>

// A label is unsafe (a number) if it carries 7+ digits. Numbers stay in the kernel.
function scrubLabel(label: string | null | undefined): string | null {
  if (label == null) return null
  return String(label).replace(/\D/g, '').length >= 7 ? null : String(label)
}
function argsContainNumber(args: ToolCall['args']): boolean {
  return Object.values(args).some((v) => typeof v === 'string' && v.replace(/\D/g, '').length >= 7)
}
function claimsFor(kind: Kind, status: ReceiptStatus): string[] {
  if (status !== 'READY_FOR_HANDOFF') {
    return status === 'NOT_CONFIGURED' ? ['reports missing number', 'preserves draft']
      : status === 'NEEDS_CLARIFICATION' ? ['asks recipient/intent']
      : status === 'CANCELLED' ? ['confirms cancel'] : ['reports failure']
  }
  return kind === 'call'
    ? ['preparing call', 'button opens dialer', 'iOS confirms']       // never "called"
    : ['message ready', 'opens WhatsApp', 'not sent until Send']       // never "sent"
}
function mapStatus(r: KernelActionResult): ReceiptStatus {
  if (r.action === 'clarify') return 'NEEDS_CLARIFICATION'
  if (r.status === 'HANDOFF_AVAILABLE' && r.canHandoff) return 'READY_FOR_HANDOFF'
  if (!r.canHandoff) return 'NOT_CONFIGURED'
  return 'FAILED'
}

// Idempotency: a repeated tool-call id / key returns the cached receipt — retries
// can never produce a duplicate handoff (control-plane law 11 partner).
const seen = new Map<string, ToolReceipt>()
export function _resetIdempotencyForTests(): void { seen.clear() }

export async function dispatchTool(call: ToolCall, ctx: ToolContext, kernel: KernelFn): Promise<ToolReceipt> {
  const cached = seen.get(ctx.idempotencyKey)
  if (cached) return cached

  const correlation = { sessionId: ctx.sessionId, turnId: ctx.turnId, actionId: ctx.actionId, toolCallId: ctx.toolCallId }
  const base = (status: ReceiptStatus, kind: Kind, recipientLabel: string | null, provenance: ToolReceipt['provenance'], reason?: string): ToolReceipt => {
    const rec: ToolReceipt = { status, kind, recipientLabel: scrubLabel(recipientLabel), revision: ctx.revision, generation: ctx.generation, correlation, provenance, allowedClaims: claimsFor(kind, status) }
    if (reason) rec.reason = reason
    seen.set(ctx.idempotencyKey, rec)
    return rec
  }

  // Privacy guard: a phone number may never travel in tool arguments.
  if (argsContainNumber(call.args)) return base('FAILED', call.args.kind ?? 'message', null, 'control-plane', 'phone-in-args-forbidden')

  if (call.name === 'cancel_active_action') return base('CANCELLED', call.args.kind ?? 'message', null, 'control-plane')

  const kind: Kind = call.name === 'prepare_call' ? 'call' : call.name === 'prepare_whatsapp' ? 'message' : (call.args.kind ?? 'message')
  const recipient = call.args.recipient ?? null
  const intent = call.args.intent ?? ''

  let result: KernelActionResult
  try { result = await kernel({ kind, recipientName: recipient, intent }) }
  catch { return base('FAILED', kind, null, 'control-plane', 'kernel-threw') }

  const status = mapStatus(result)
  return base(status, result.mode ?? kind, result.recipientName, 'contacts-kernel')
}
