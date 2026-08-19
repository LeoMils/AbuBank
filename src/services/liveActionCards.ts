/*
 * liveActionCards.ts — Abu AI live path: the ACTION-CARD view models (pure).
 * ════════════════════════════════════════════════════════════════════════════
 * Governing rule (Part B): Abu never claims an action in speech alone. Every action
 * produces a VISIBLE card in the live overlay, and the card is the receipt.
 *
 * This module owns NO UI and NO number lookup — it turns a LiveCommDraft /
 * CalendarDraft / persisted LiveEvent into a plain LiveCard the overlay renders.
 * The recipient's phone number is resolved OUTSIDE the model, at the UI layer, via
 * an injected `Handoff` (the existing whatsappAdapter/phoneAdapter). The number is
 * encoded straight into the wa.me / tel link and is NEVER part of the card text or
 * the model context — privacy by construction, same as the adapters.
 */
import type { CalendarDraft } from '../screens/AbuAI/realtime/calendarDraft'
import { formatHebrewDate } from '../screens/AbuCalendar/service'
import type { LiveCommDraft, LiveEvent } from './liveTools'

export type LiveCardKind = 'whatsapp' | 'call' | 'calendar-draft' | 'calendar-receipt'

export interface LiveCard {
  kind: LiveCardKind
  /** Hebrew title (large, top of card). */
  title: string
  /** Hebrew body lines (recipient, message, event fields…). */
  lines: string[]
  /** External-link primary button (wa.me / tel:). Opens outside; no session feedback. */
  primaryHref?: string
  /** In-session primary action (confirm a calendar draft) — handled by the overlay. */
  primaryAction?: 'confirm-calendar'
  /** Label of the large primary button. */
  primaryLabel?: string
  /** When set, the primary affordance is UNAVAILABLE — show this honest reason
   *  instead of a dead button (e.g. no phone number for this contact). */
  disabledReason?: string
}

/** Resolve a recipient NAME to a channel deep link (wa.me / tel:). Injected so the
 *  number never enters this module or the model; production wires the existing
 *  whatsappAdapter/phoneAdapter.buildHandoff. */
export type Handoff = (name: string, text: string) => { url: string | null; reason: string | null }

function reasonHe(recipient: string, reason: string | null): string {
  if (reason === 'no_whatsapp') return `אין לי מספר וואטסאפ של ${recipient}`
  if (reason === 'no_phone') return `אין לי מספר טלפון של ${recipient}`
  return `אין לי איך להגיע ל${recipient}`
}

/** WhatsApp card: recipient + the FULL composed message + a Send button (wa.me). */
export function buildWhatsAppCard(draft: LiveCommDraft, handoff: Handoff): LiveCard {
  const recipient = draft.recipientLabel ?? 'הנמען'
  const message = draft.intent ?? ''
  const { url, reason } = handoff(recipient, message)
  const base: LiveCard = {
    kind: 'whatsapp',
    title: 'הודעת וואטסאפ מוכנה',
    lines: [`אל: ${recipient}`, message],
  }
  if (url) return { ...base, primaryHref: url, primaryLabel: 'שליחה בוואטסאפ' }
  return { ...base, disabledReason: reasonHe(recipient, reason) }
}

/** Extract the dialled number from a tel: link for on-screen display (Martita's own
 *  contact, shown only on her device — never sent to the model). */
function telNumber(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/^tel:(\+?[\d]+)/)
  return m ? m[1]! : null
}

/** Call card: name + number + a Call button (tel:). */
export function buildCallCard(draft: LiveCommDraft, handoff: Handoff): LiveCard {
  const recipient = draft.recipientLabel ?? 'הנמען'
  const { url, reason } = handoff(recipient, '')
  const num = telNumber(url)
  const base: LiveCard = {
    kind: 'call',
    title: 'שיחה מוכנה',
    lines: num ? [`שיחה אל: ${recipient}`, num] : [`שיחה אל: ${recipient}`],
  }
  if (url) return { ...base, primaryHref: url, primaryLabel: 'התקשרי' }
  return { ...base, disabledReason: reasonHe(recipient, reason) }
}

/** Format a draft/event's fields into Hebrew body lines (shared by draft + receipt). */
function eventLines(f: { title?: string | null; date?: string | null; time?: string | null; location?: string | null; participant?: string | null }): string[] {
  const lines: string[] = []
  if (f.title) lines.push(f.title)
  if (f.date) lines.push(f.time ? `${formatHebrewDate(f.date)} · ${f.time}` : formatHebrewDate(f.date))
  if (f.location) lines.push(`📍 ${f.location}`)
  if (f.participant) lines.push(`עם ${f.participant}`)
  return lines
}

/** Calendar DRAFT card: the pending event + a Confirm button. Returns null for a
 *  draft that is not something to confirm (cancelled / already committed / empty). */
export function buildCalendarDraftCard(draft: CalendarDraft | null): LiveCard | null {
  if (!draft) return null
  if (draft.confirmation === 'CANCELLED' || draft.confirmation === 'CONFIRMED') return null
  const lines = eventLines(draft)
  if (lines.length === 0) return null
  return {
    kind: 'calendar-draft',
    title: 'טיוטת פגישה — עדיין לא נשמר',
    lines,
    primaryAction: 'confirm-calendar',
    primaryLabel: 'לאשר ולשמור',
  }
}

/** Calendar RECEIPT card: shown AFTER commit, with the fields AS ACTUALLY PERSISTED. */
export function buildCalendarReceiptCard(event: LiveEvent): LiveCard {
  return {
    kind: 'calendar-receipt',
    title: 'נשמר ביומן ✓',
    lines: eventLines(event),
  }
}
