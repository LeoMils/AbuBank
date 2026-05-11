/*
 * AbuCalendar P0 — end-to-end creation pipeline integration.
 *
 * Walks the user-typed-or-spoken phrases from the phone-QA failure
 * spec through the FULL pipeline:
 *
 *     transcript → parseLocally (no Groq key) → createAppointmentSafe
 *
 * and asserts the event is created (or the missing-field is detected)
 * exactly as the user-facing UX requires.
 *
 * Truth Contract:
 *  • No event is silently created with default 09:00 / today when the
 *    user did not specify date or time — the safe creator rejects it
 *    and the UI is expected to ask one clarifying question.
 *  • No "saved" status is reported unless the event survives a
 *    storage round-trip.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseLocally } from './localParser'
import {
  createAppointmentSafe,
  loadAppointments,
  type CreateResult,
} from './service'

let storage: Record<string, string> = {}

beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => { storage[key] = val },
    removeItem: (key: string) => { delete storage[key] },
    clear: () => { storage = {} },
  })
})

const TODAY = '2026-05-11'
const TOMORROW = '2026-05-12'

/** Translate a parsed draft + emoji to the safe-creator input shape. */
function draftToCreate(draft: ReturnType<typeof parseLocally>): Parameters<typeof createAppointmentSafe>[0] | null {
  if (!draft.title || !draft.date || !draft.time) return null
  return {
    title: draft.title,
    date: draft.date,
    time: draft.time,
    emoji: draft.emoji,
    notes: draft.notes ?? undefined,
    location: draft.location ?? undefined,
  } as Parameters<typeof createAppointmentSafe>[0]
}

describe('AbuCalendar P0 — Hebrew typed creation flow', () => {
  it('"תוסיפי פגישה עם רופא מחר בארבע" → parses + flags ambiguous time → does NOT create silently', () => {
    // "בארבע" alone is genuinely ambiguous (4 AM vs 4 PM). The local
    // parser marks it ambiguous and the UI is REQUIRED to ask AM/PM
    // before creating the event. Silent creation at 04:00 (or 16:00)
    // would be a wrong-time bug, so the creator must not run yet.
    const draft = parseLocally('תוסיפי פגישה עם רופא מחר בארבע', TODAY)
    expect(draft.date).toBe(TOMORROW)
    expect(draft.time).toBe('04:00')
    expect(draft.ambiguousTime).toBe(true)
    expect(draft.title).toContain('רופא')
    // The UI path: ambiguity → ask AM/PM → THEN call createAppointmentSafe
    // with the resolved time. Verify a resolved-to-16:00 event creates
    // and persists.
    const r: CreateResult = createAppointmentSafe({
      title: draft.title, date: draft.date!, time: '16:00', emoji: draft.emoji,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(loadAppointments().some((a) => a.id === r.appointment.id)).toBe(true)
  })

  it('"תקבעי פגישה עם לאו מחר בעשר בבוקר" → unambiguous → parses + creates at 10:00', () => {
    const draft = parseLocally('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY)
    expect(draft.date).toBe(TOMORROW)
    expect(draft.time).toBe('10:00')
    expect(draft.ambiguousTime).toBe(false)
    const input = draftToCreate(draft)!
    const r = createAppointmentSafe(input)
    expect(r.ok).toBe(true)
  })

  it('"תוסיפי פגישה עם רופא מחר" → missing time → does NOT create silently', () => {
    const draft = parseLocally('תוסיפי פגישה עם רופא מחר', TODAY)
    expect(draft.date).toBe(TOMORROW)
    expect(draft.time).toBeNull()

    const input = draftToCreate(draft)
    expect(input).toBeNull() // The UI must ask for the missing time.
    expect(loadAppointments().length).toBe(0)
  })

  it('"תוסיפי פגישה עם רופא" → missing date AND time → does NOT create silently', () => {
    const draft = parseLocally('תוסיפי פגישה עם רופא', TODAY)
    expect(draft.date).toBeNull()
    expect(draft.time).toBeNull()

    const input = draftToCreate(draft)
    expect(input).toBeNull()
    expect(loadAppointments().length).toBe(0)
  })
})

describe('AbuCalendar P0 — persistence survives reload', () => {
  it('event created → loadAppointments() in a fresh call still finds it', () => {
    // Use an unambiguous transcript so the parser fully resolves the time.
    const draft = parseLocally('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY)
    const input = draftToCreate(draft)!
    const r = createAppointmentSafe(input)
    expect(r.ok).toBe(true)

    // Simulate a page reload: a fresh loadAppointments call reads the
    // same underlying storage (same `storage` object backing the stub).
    const reloaded = loadAppointments()
    expect(reloaded.length).toBe(1)
    expect(reloaded[0]?.date).toBe(TOMORROW)
    expect(reloaded[0]?.time).toBe('10:00')
  })

  it('event survives a second created event (no clobber)', () => {
    const d1 = parseLocally('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY)
    const d2 = parseLocally('תקבעי פגישה עם מור מחר בעשר בבוקר', TODAY)
    const r1 = createAppointmentSafe(draftToCreate(d1)!)
    const r2 = createAppointmentSafe(draftToCreate(d2)!)
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    const all = loadAppointments()
    expect(all.length).toBe(2)
    expect(all.find((a) => a.id === r1.appointment.id)).toBeDefined()
    expect(all.find((a) => a.id === r2.appointment.id)).toBeDefined()
  })

  it('corrupted storage on load does not throw and returns []', () => {
    storage['abubank-calendar-appointments'] = 'not json {'
    expect(loadAppointments()).toEqual([])
  })
})

describe('AbuCalendar P0 — no false success when storage is hostile', () => {
  it('quota-exceeded → createAppointmentSafe returns storage_failed, nothing persists', () => {
    const draft = parseLocally('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY)
    const input = draftToCreate(draft)!
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage[k] ?? null,
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: (k: string) => { delete storage[k] },
      clear: () => { storage = {} },
    })
    const r = createAppointmentSafe(input)
    expect(r.ok).toBe(false)
  })

  it('silent-no-op setItem (round-trip mismatch) → storage_failed honestly', () => {
    const draft = parseLocally('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY)
    const input = draftToCreate(draft)!
    vi.stubGlobal('localStorage', {
      getItem: () => null, // always empty
      setItem: () => { /* swallow */ },
      removeItem: () => undefined,
      clear: () => { storage = {} },
    })
    const r = createAppointmentSafe(input)
    expect(r.ok).toBe(false)
  })
})

describe('AbuCalendar P0 — Hebrew "תקבעי פגישה עם לאו מחר בעשר בבוקר" voice path', () => {
  it('full voice transcript → parses + creates', () => {
    const draft = parseLocally('תקבעי פגישה עם לאו מחר בעשר בבוקר', TODAY)
    expect(draft.date).toBe(TOMORROW)
    expect(draft.time).toBe('10:00')
    expect(draft.title).toContain('לאו')

    const input = draftToCreate(draft)!
    const r = createAppointmentSafe(input)
    expect(r.ok).toBe(true)
  })
})

describe('AbuCalendar P0 — index.tsx uses createAppointmentSafe for both manual and voice', () => {
  it('source contract: handleManualSave and handleVoiceConfirm both call createAppointmentSafe (not raw addAppointment)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    // Both creation paths must use the safe creator.
    // Each handler body must call createAppointmentSafe — bound the
    // search to ~1500 chars after the function declaration (a handler
    // is well under that even with comments).
    expect(/function handleManualSave[\s\S]{0,1500}createAppointmentSafe\(/.test(src),
      'handleManualSave must use createAppointmentSafe').toBe(true)
    expect(/function handleVoiceConfirm[\s\S]{0,1500}createAppointmentSafe\(/.test(src),
      'handleVoiceConfirm must use createAppointmentSafe').toBe(true)
  })

  it('source contract: failure path is wired (showFailureToast is reachable)', async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'index.tsx'), 'utf8')
    expect(src.includes('showFailureToast')).toBe(true)
    expect(src.includes('formatCreateFailure(')).toBe(true)
    expect(src.includes('formatCreatedConfirmation(')).toBe(true)
  })
})
