/*
 * Phone (call) channel adapter — Communication Capability.
 * ────────────────────────────────────────────────────────
 * Resolves a family name to a phone-bearing contact and builds a sanitized
 * `tel:` handoff. The OS then shows its own call confirmation; Martita presses
 * Call. It NEVER dials automatically and the cognitive controller never builds a
 * tel: URL — only this adapter does.
 *
 * PRIVACY: the phone number is resolved on demand and encoded straight into the
 * tel: link; it is never part of the CommunicationAction or telemetry.
 */
import type { ChannelAdapter } from '../AbuAI/communication/types'
import { resolveContactForName, sanitizePhoneE164 } from './familyQuickFaces'
import { isValidPhoneE164 } from './familyQuickFaces'

export const phoneAdapter: ChannelAdapter = {
  id: 'phone',
  channel: 'phone',
  primaryActionLabel: 'התקשרי',

  resolveRecipient(name: string) {
    const r = resolveContactForName(name)
    if (!r) return null
    // A CALL needs a real telephone number specifically (phoneE164), which may
    // differ from a WhatsApp-only handle.
    const canHandoff = isValidPhoneE164(r.face.phoneE164)
    return { canHandoff, confidence: 1 }
  },

  // draftText is unused for a call — a call has no message body.
  buildHandoff(name: string, _draftText: string) {
    const r = resolveContactForName(name)
    if (!r) return { url: null, reason: 'unknown_recipient' }
    if (!isValidPhoneE164(r.face.phoneE164)) return { url: null, reason: 'no_phone' }
    const digits = sanitizePhoneE164(r.face.phoneE164) // digits only, no +, no spaces
    return { url: `tel:+${digits}`, reason: null }
  },
}
