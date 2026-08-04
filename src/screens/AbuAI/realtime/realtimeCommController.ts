/*
 * REALTIME COMMUNICATION CONTROLLER (ADR-0001 §5/§7/§12) — the LIVE production adapter.
 * ════════════════════════════════════════════════════════════════════════════════════
 * Connects the real Realtime session's function-call events to the deterministic
 * authority stack and back to the model. It is the ONE seam between "model talk" and
 * "product truth":
 *   model function_call ─► [map to a turn] ─► SessionOrchestrator.acceptTurn
 *        (control plane commits · kernel resolves · receipt) ─► onCard(viewModel)
 *        ─► conversation.item.create(function_call_output = SAFE receipt strings)
 *        ─► response.create (model speaks, grounded) ─► guardSpeech(transcript)
 *
 * It owns NO wording and NO truth of its own — the kernel decides, the control plane
 * orders, the monitor guards. Privacy by construction: the function_call_output can
 * only ever contain safe labels/statuses (never a phone number). Duplicate model call
 * ids are idempotent (a retry re-sends the same receipt, never a second handoff).
 * Injected `send` + orchestrator make it fully unit-testable without WebRTC.
 */
import { SessionOrchestrator, type ActiveActionViewModel } from './sessionOrchestrator'
import type { Kind } from './controlPlane'
import type { TurnType } from './controlPlane'
import { safeParseArgs, type ParsedFunctionCall } from './realtimeFunctionBridge'

export type SendEvent = (event: Record<string, unknown>) => void

export interface TruthIncident {
  kind: 'fabricated_completion' | 'unsupported_denial'
  violations: string[]
}

export interface CommControllerCallbacks {
  /** Render/refresh the ONE canonical card from the committed view-model. */
  onCard: (vm: ActiveActionViewModel) => void
  /** A privacy-safe product-truth incident (fabricated completion / unsupported denial). */
  onIncident?: (incident: TruthIncident) => void
}

export class RealtimeCommController {
  private seq = 0
  private readonly handled = new Map<string, ActiveActionViewModel>()

  constructor(
    private readonly orch: SessionOrchestrator,
    private readonly send: SendEvent,
    private readonly cb: CommControllerCallbacks,
  ) {}

  /**
   * Handle a completed function call from the live model. Maps it to a control-plane
   * turn (using the current committed state to tell START from REPLACE), executes via
   * the kernel, commits, returns the SAFE receipt to the model, and continues it.
   */
  async onFunctionCall(fc: ParsedFunctionCall): Promise<ActiveActionViewModel> {
    // Idempotency: a duplicate model call id re-sends the SAME receipt — never a
    // second handoff / a second card (ADR §12 retries-cannot-duplicate).
    const cached = this.handled.get(fc.callId)
    if (cached) {
      this.replyToModel(fc.callId, cached)
      return cached
    }

    const args = safeParseArgs(fc.argsJson)
    const cur = this.orch.viewModel()
    const active = cur.visible && !!cur.cardId
    const recipient = typeof args.recipient === 'string' && args.recipient.trim() ? args.recipient.trim() : (cur.recipientLabel ?? null)
    const intent = typeof args.intent === 'string' ? args.intent : ''
    const argKind: Kind | undefined = args.kind === 'call' || args.kind === 'message' ? args.kind : undefined
    const kind: Kind = fc.name === 'prepare_call' ? 'call' : fc.name === 'prepare_whatsapp' ? 'message' : (argKind ?? cur.kind)

    let turnType: TurnType
    if (fc.name === 'cancel_active_action') turnType = 'CANCEL_ACTION'
    else if (!active) turnType = 'START_ACTION'
    else if (fc.name === 'replace_active_action' || kind !== cur.kind) turnType = 'REPLACE_ACTION'
    else turnType = 'CONTINUE_ACTION'

    const outcome = await this.orch.acceptTurn({ seq: ++this.seq, turnType, kind, recipientLabel: recipient, intent })
    const vm = outcome.viewModel
    this.handled.set(fc.callId, vm)
    this.cb.onCard(vm)
    this.replyToModel(fc.callId, vm)
    return vm
  }

  /** Return ONLY safe receipt strings to the model, then let it continue speaking. */
  private replyToModel(callId: string, vm: ActiveActionViewModel): void {
    const output = {
      status: vm.status,                 // only ever a preparation/handoff status — never "sent"
      kind: vm.kind,
      recipient: vm.recipientLabel,      // safe label or null — never a number
      allowed_to_say: vm.allowedClaims,  // permitted spoken meanings (no completion)
      note: vm.a11y,
    }
    this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output) } })
    this.send({ type: 'response.create' })
  }

  /**
   * Guard the model's spoken transcript (§11 bounded monitor). A fabricated completion
   * (always) or an unsupported denial (vs a READY receipt) triggers a truthful repair on
   * the NEXT turn (streamed audio cannot be un-said) + a privacy-safe incident. Returns
   * whether the utterance was clean.
   */
  onAssistantTranscript(text: string): { ok: boolean } {
    const verdict = this.orch.guardSpeech(text)
    if (verdict.allowed) return { ok: true }
    const kind: TruthIncident['kind'] = verdict.violations.some((v) => v.startsWith('completion')) ? 'fabricated_completion' : 'unsupported_denial'
    this.cb.onIncident?.({ kind, violations: verdict.violations })
    this.send({ type: 'response.create', response: { instructions: `Say EXACTLY this in Hebrew and nothing else: "${verdict.safeText}"` } })
    return { ok: false }
  }

  viewModel(): ActiveActionViewModel { return this.orch.viewModel() }
}
