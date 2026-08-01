/*
 * Communication Capability — the channel-agnostic producer of a verified
 * communication handoff Action.
 * ─────────────────────────────────────────────────────────────────────────
 * Given a detected communication turn, it: resolves the recipient (via the
 * channel adapter), composes the message (shared composer), VERIFIES facts +
 * non-empty draft, and returns a CommunicationAction. It knows nothing about
 * WhatsApp specifically — only about the ChannelAdapter contract. Adding a new
 * channel needs a new adapter, not a change here.
 */
import { composeWhatsAppMessage, verifyDraft, type WhatsAppTurn } from '../whatsappCompose'
import { getAdapter } from './registry'
import { renderResponse } from './engine'
import type { CommunicationAction, CommunicationChannel } from './types'

export interface BuildActionOpts {
  /** Which channel to hand off to (default whatsapp — the first adapter). */
  channel?: CommunicationChannel
}

/**
 * Turn a communication turn into a verified CommunicationAction. Never throws —
 * the composer has a deterministic local fallback, so a draft always exists.
 * Returns action:'clarify' when the recipient or the message is missing.
 */
export async function buildCommunicationAction(
  turn: WhatsAppTurn,
  opts: BuildActionOpts = {},
): Promise<CommunicationAction> {
  const mode: 'message' | 'call' = turn.kind === 'call' ? 'call' : 'message'
  // Call turns hand off through the phone adapter; compose turns through the
  // messaging adapter (default WhatsApp). The controller stays channel-agnostic.
  const channel = mode === 'call' ? 'phone' : (opts.channel ?? 'whatsapp')
  const adapter = getAdapter(channel)
  const label = adapter?.primaryActionLabel ?? (mode === 'call' ? 'התקשרי' : 'פתחי')
  const name = (turn.targetHebrew ?? turn.targetName ?? '').trim()

  const base = (partial: Partial<CommunicationAction>): CommunicationAction => ({
    capability: 'communication', action: 'handoff', channel, adapter: adapter?.id ?? channel,
    primaryActionLabel: label, mode,
    recipient: { name, canHandoff: false, confidence: 0 },
    draft: { text: '', style: turn.command?.style ?? 'normal', language: turn.command?.plan.language ?? 'he' },
    verification: { ok: true, issues: [], missingFacts: [] },
    ...partial,
  })
  const clarify = (field: 'recipient' | 'intent', prompt: string): CommunicationAction =>
    base({ action: 'clarify', verification: { ok: false, issues: ['incomplete'], missingFacts: [] }, clarify: { field, prompt } })

  if (!name) return clarify('recipient', 'למי? תגידי לי את השם.')

  const resolved = adapter?.resolveRecipient(name) ?? null
  // Recipient did not resolve to ONE confident contact (ambiguous or unknown) —
  // never guess; ask ONE short clarification and keep the pending action.
  if (resolved === null) {
    return clarify('recipient', `לא בטוחה למי בדיוק — תגידי לי שוב את השם של ${name}?`)
  }

  // ── CALL: no message body; just verify we can reach the phone adapter. ──
  if (mode === 'call') {
    return base({ recipient: { name, canHandoff: resolved?.canHandoff ?? false, confidence: resolved?.confidence ?? 0 } })
  }

  // ── MESSAGE: compose + verify (facts, non-empty). ──
  if (!turn.command || !turn.command.intent) return clarify('intent', `מה לכתוב ל${name}?`)
  const text = await composeWhatsAppMessage(turn.command, { recipientLabel: name })
  const v = verifyDraft(turn.command, text)
  return base({
    recipient: { name, canHandoff: resolved?.canHandoff ?? false, confidence: resolved?.confidence ?? 0 },
    draft: { text, style: turn.command.style, language: turn.command.plan.language },
    verification: { ok: v.ok, issues: v.issues, missingFacts: v.missingFacts },
    ...(turn.command.wantsReview ? { review: true } : {}),
  })
}

/** The chat lead line that accompanies the Action (or the clarify question).
 *  It is produced by the ONE response-truth policy (engine.renderResponse) so
 *  the wording always agrees with the action status — never claims a send/dial,
 *  never denies a live handoff, never mentions calendar (Laws 6,7,9). */
export function communicationLead(action: CommunicationAction): string {
  if (action.action === 'clarify') return action.clarify?.prompt ?? 'מה לכתוב?'
  const canHandoff = action.recipient.canHandoff
  return renderResponse({
    mode: action.mode,
    status: canHandoff ? 'HANDOFF_AVAILABLE' : 'FAILED',
    recipientName: action.recipient.name || null,
    hasHandoff: canHandoff,
  }).text
}
