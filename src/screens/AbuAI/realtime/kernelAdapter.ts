/*
 * PRODUCTION KERNEL ADAPTER (ADR-0001 §7/§12).
 * ────────────────────────────────────────────
 * The tool dispatcher (realtimeTools) is kernel-agnostic and takes an injected
 * KernelFn. This adapter is the ONE production binding: it delegates to the single
 * Communication kernel authority (`buildCommunicationAction`) — the SAME reducer +
 * recipient resolution the typed path uses — so the Realtime slice and the typed
 * path can never diverge into two truth owners. It adds NO semantics: it only
 * shapes a WhatsAppTurn the kernel understands and maps the kernel result to the
 * dispatcher's minimal contract. A phone number never enters or leaves here.
 */
import { buildCommunicationAction } from '../communication/capability'
import { detectWhatsAppTurn, type WhatsAppTurn } from '../whatsappCompose'
import type { KernelFn, KernelActionResult } from './realtimeTools'

export function makeProductionKernel(): KernelFn {
  return async ({ kind, recipientName, intent }): Promise<KernelActionResult> => {
    let turn: WhatsAppTurn
    if (kind === 'call') {
      turn = { kind: 'call', targetName: recipientName, targetHebrew: recipientName, command: null }
    } else {
      // Reuse the single deterministic parser to build a full compose command when
      // the intent utterance leads with a write verb; otherwise hand a bare turn so
      // the kernel asks its own clarification (never guesses).
      const parsed = intent ? detectWhatsAppTurn(intent, { source: 'voice' }) : null
      turn = parsed && parsed.kind === 'compose'
        ? { ...parsed, targetName: recipientName ?? parsed.targetName, targetHebrew: recipientName ?? parsed.targetHebrew }
        : { kind: 'compose', targetName: recipientName, targetHebrew: recipientName, command: null }
    }

    const action = await buildCommunicationAction(turn)
    const status = action.action === 'clarify'
      ? 'CLARIFY'
      : action.recipient.canHandoff ? 'HANDOFF_AVAILABLE' : 'FAILED'
    return {
      action: action.action,
      mode: action.mode,
      recipientName: action.recipient.name || null,
      canHandoff: action.recipient.canHandoff,
      status,
    }
  }
}
