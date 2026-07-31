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
  const channel = opts.channel ?? 'whatsapp'
  const adapter = getAdapter(channel)
  const label = adapter?.primaryActionLabel ?? 'פתחי'
  const name = (turn.targetHebrew ?? turn.targetName ?? '').trim()

  const clarify = (field: 'recipient' | 'intent', prompt: string): CommunicationAction => ({
    capability: 'communication', action: 'clarify', channel, adapter: adapter?.id ?? channel,
    primaryActionLabel: label,
    recipient: { name, canHandoff: false, confidence: 0 },
    draft: { text: '', style: turn.command?.style ?? 'normal', language: turn.command?.plan.language ?? 'he' },
    verification: { ok: false, issues: ['incomplete'], missingFacts: [] },
    clarify: { field, prompt },
  })

  if (!name) return clarify('recipient', 'למי לכתוב? תגידי לי את השם.')
  if (!turn.command || !turn.command.intent) return clarify('intent', `מה לכתוב ל${name}?`)

  // Recipient resolution (channel-specific) — verify we can actually hand off.
  const resolved = adapter?.resolveRecipient(name) ?? null

  // Compose + verify (facts, non-empty). Composition is channel-agnostic voice.
  const text = await composeWhatsAppMessage(turn.command, { recipientLabel: name })
  const v = verifyDraft(turn.command, text)

  return {
    capability: 'communication', action: 'handoff', channel, adapter: adapter?.id ?? channel,
    primaryActionLabel: label,
    recipient: { name, canHandoff: resolved?.canHandoff ?? false, confidence: resolved?.confidence ?? 0 },
    draft: { text, style: turn.command.style, language: turn.command.plan.language },
    verification: { ok: v.ok, issues: v.issues, missingFacts: v.missingFacts },
  }
}

/** The chat lead line that accompanies the Action card (or the clarify question). */
export function communicationLead(action: CommunicationAction): string {
  if (action.action === 'clarify') return action.clarify?.prompt ?? 'מה לכתוב?'
  const name = action.recipient.name
  return name ? `כתבתי ל${name}:` : 'כתבתי:'
}
