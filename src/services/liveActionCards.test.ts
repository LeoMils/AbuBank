/*
 * liveActionCards.test.ts — the action-card view-model builders (CODE evidence).
 * Proves the card data is correct WITHOUT a browser: recipient + message + wa.me,
 * tel: for a call, calendar draft/receipt, and the HONEST no-number path. The
 * number resolver is injected, so no real contacts are touched.
 */
import { describe, it, expect } from 'vitest'
import {
  buildWhatsAppCard, buildCallCard, buildCalendarDraftCard, buildCalendarReceiptCard,
  type Handoff,
} from './liveActionCards'
import type { LiveCommDraft, LiveEvent } from './liveTools'
import type { CalendarDraft } from '../screens/AbuAI/realtime/calendarDraft'

const waOk: Handoff = (_n, text) => ({ url: `https://wa.me/972545000005?text=${encodeURIComponent(text)}`, reason: null })
const telOk: Handoff = () => ({ url: 'tel:+972545000005', reason: null })
const noNumber: Handoff = () => ({ url: null, reason: 'unknown_recipient' })

const msgDraft = (recipientLabel: string, intent: string): LiveCommDraft =>
  ({ kind: 'message', recipientId: 'x', recipientLabel, intent, status: 'READY_TO_SEND' })
const callDraft = (recipientLabel: string): LiveCommDraft =>
  ({ kind: 'call', recipientId: 'x', recipientLabel, intent: null, status: 'READY_TO_CALL' })

describe('whatsapp card', () => {
  it('shows recipient + full message and a wa.me Send link with the message encoded', () => {
    const c = buildWhatsAppCard(msgDraft('מור', 'נתראה בשישי בשבע'), waOk)
    expect(c.kind).toBe('whatsapp')
    expect(c.lines).toEqual(['אל: מור', 'נתראה בשישי בשבע'])
    expect(c.primaryLabel).toBe('שליחה בוואטסאפ')
    expect(c.primaryHref).toContain('https://wa.me/972545000005?text=')
    expect(c.primaryHref).toContain(encodeURIComponent('נתראה בשישי בשבע'))
    expect(c.disabledReason).toBeUndefined()
  })
  it('when there is no number, shows an HONEST reason and no dead button', () => {
    const c = buildWhatsAppCard(msgDraft('גבי', 'שלום'), noNumber)
    expect(c.primaryHref).toBeUndefined()
    expect(c.disabledReason).toContain('גבי')
  })
})

describe('call card', () => {
  it('shows the name + number and a tel: Call link', () => {
    const c = buildCallCard(callDraft('לאו'), telOk)
    expect(c.kind).toBe('call')
    expect(c.lines[0]).toBe('שיחה אל: לאו')
    expect(c.lines[1]).toBe('+972545000005')
    expect(c.primaryLabel).toBe('התקשרי')
    expect(c.primaryHref).toBe('tel:+972545000005')
  })
  it('no number → honest reason', () => {
    const c = buildCallCard(callDraft('דוד'), noNumber)
    expect(c.primaryHref).toBeUndefined()
    expect(c.disabledReason).toContain('דוד')
  })
})

describe('calendar draft card', () => {
  const draft = (over: Partial<CalendarDraft>): CalendarDraft => ({
    participant: null, participants: [], unresolvedRelationship: null, title: 'פגישה', date: '2026-08-20', time: '16:00',
    durationMin: null, location: 'קפה נמרוד', notes: null, provenance: {}, revision: 1, confirmation: 'AWAITING_CONFIRM', ...over,
  })
  it('shows the pending fields + a Confirm action (not saved yet)', () => {
    const c = buildCalendarDraftCard(draft({}))!
    expect(c.kind).toBe('calendar-draft')
    expect(c.title).toContain('עדיין לא נשמר')
    expect(c.primaryAction).toBe('confirm-calendar')
    expect(c.primaryLabel).toBe('לאשר ולשמור')
    expect(c.lines.some((l) => l.includes('קפה נמרוד'))).toBe(true)
    expect(c.lines.some((l) => l.includes('16:00'))).toBe(true)
  })
  it('returns null for a cancelled or already-confirmed draft (no draft card)', () => {
    expect(buildCalendarDraftCard(draft({ confirmation: 'CANCELLED' }))).toBeNull()
    expect(buildCalendarDraftCard(draft({ confirmation: 'CONFIRMED' }))).toBeNull()
    expect(buildCalendarDraftCard(null)).toBeNull()
  })
})

describe('calendar receipt card', () => {
  it('shows the fields AS PERSISTED with a saved title', () => {
    const ev: LiveEvent = { id: 'e1', title: 'רופא', date: '2026-08-20', time: '10:00', location: 'מרפאת כללית', participant: 'מור' }
    const c = buildCalendarReceiptCard(ev)
    expect(c.kind).toBe('calendar-receipt')
    expect(c.title).toContain('נשמר')
    expect(c.lines.some((l) => l.includes('מרפאת כללית'))).toBe(true)
    expect(c.lines.some((l) => l.includes('מור'))).toBe(true)
    expect(c.primaryAction).toBeUndefined() // a receipt has no primary — just dismiss
  })
})
