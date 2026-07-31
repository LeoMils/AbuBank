/*
 * WhatsApp channel adapter — the FIRST Communication Capability adapter.
 * ─────────────────────────────────────────────────────────────────────
 * Channel-specific: it knows how to resolve a family name to a phone-bearing
 * contact and how to build the wa.me deep link that OPENS the conversation with
 * the reviewed message PRE-FILLED (never auto-send, never alter the text).
 * Holds NO composition logic — that is the channel-agnostic capability.
 *
 * PRIVACY: the phone number never leaves this module — it is resolved on demand
 * and encoded straight into the deep link; it is not part of the Action object.
 */
import type { ChannelAdapter } from '../AbuAI/communication/types'
import { resolveContactForName, buildWhatsAppPersonUrl } from './familyQuickFaces'

export const whatsappAdapter: ChannelAdapter = {
  id: 'whatsapp',
  channel: 'whatsapp',
  primaryActionLabel: 'פתחי בוואטסאפ',

  resolveRecipient(name: string) {
    const r = resolveContactForName(name)
    if (!r) return null
    return { canHandoff: r.actionable, confidence: 1 }
  },

  buildHandoff(name: string, draftText: string) {
    const r = resolveContactForName(name)
    if (!r) return { url: null, reason: 'unknown_recipient' }
    if (!r.actionable) return { url: null, reason: 'no_phone' }
    // Prefill only — WhatsApp still requires a manual send tap (no auto-send).
    return { url: buildWhatsAppPersonUrl(r.face, draftText), reason: null }
  },
}
