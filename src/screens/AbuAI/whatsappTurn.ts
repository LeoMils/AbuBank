/*
 * Abu AI ↔ WhatsApp compose bridge.
 * ─────────────────────────────────
 * Turns a controller-detected WhatsApp/call turn into a chat reply: for a
 * compose turn it drafts the message with the shared compose capability and
 * copies it to the clipboard; for a call turn it gives a correct, name-filled
 * hand-off. Kept out of the sync cognitive controller (composition is async).
 *
 * PRIVACY: no phone number is ever composed into the LLM prompt or spoken — only
 * the recipient NAME + message content. The deep link (if any) is built later in
 * the AbuWhatsApp channel adapter.
 */
import { composeWhatsAppMessage, type WhatsAppTurn } from './whatsappCompose'

export interface WhatsAppReply {
  /** Chat bubble text. */
  text: string
  /** TTS-safe spoken text (shorter — the draft, not the instructions). */
  speak: string
  /** The composed draft (compose turns only). */
  draft: string | null
}

function safeCopy(text: string): void {
  try {
    if (typeof navigator !== 'undefined') navigator.clipboard?.writeText(text)?.catch(() => {})
  } catch { /* clipboard unavailable */ }
}

/**
 * Build Abu AI's reply for a WhatsApp/call turn. Never throws — the composer has
 * a deterministic local fallback, so a draft is always produced.
 */
export async function buildWhatsAppReply(wa: WhatsAppTurn): Promise<WhatsAppReply> {
  const name = (wa.targetHebrew ?? wa.targetName ?? '').trim()

  if (wa.kind === 'call') {
    const text = name
      ? `להתקשר ל${name}? פתחי את אבו וואטסאפ ולחצי על התמונה של ${name} — שם יש כפתור להתקשר.`
      : 'למי להתקשר? תגידי לי את השם ואני אכוון אותך.'
    return { text, speak: text, draft: null }
  }

  // Compose turn.
  if (!wa.command || !wa.command.intent) {
    const ask = name ? `מה לכתוב ל${name}?` : 'למי לכתוב, ומה?'
    return { text: ask, speak: ask, draft: null }
  }

  const draft = await composeWhatsAppMessage(wa.command, { recipientLabel: name || null })
  safeCopy(draft)

  const lead = name ? `כתבתי ל${name}:` : 'כתבתי:'
  const text = `${lead}\n\n"${draft}"\n\nהעתקתי לך את ההודעה 📋 — פתחי את אבו וואטסאפ ולחצי על ${name || 'הנמען'} כדי לשלוח.`
  const speak = `${lead} ${draft}`
  return { text, speak, draft }
}
