/*
 * AbuCalendar P0 — creation reliability diagnostic.
 *
 * Reproduces the "user created a meeting and it was not created" phone-QA
 * failure across five distinct silent-failure paths:
 *
 *   1. addAppointment() doesn't return a structured result, so the caller
 *      cannot know whether the event actually persisted.
 *   2. saveAppointments() swallows storage errors (iOS Safari private mode
 *      / quota exceeded / blocked localStorage) and the caller is told
 *      "saved" anyway.
 *   3. The UI confirmation toast says only "האירוע נשמר" — no title /
 *      date / time, no way to verify Martita created the RIGHT event.
 *   4. There is no failure surface: if save fails, no "לא הצלחתי לשמור"
 *      copy appears anywhere.
 *   5. Validation: addAppointment accepts blank title / date / time and
 *      writes a junk event to storage.
 *
 * These tests describe the desired contract AFTER the P0 fix lands.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createAppointmentSafe,
  loadAppointments,
  formatCreatedConfirmation,
  formatCreateFailure,
  formatMissingFieldQuestion,
} from './service'

let storage: Record<string, string> = {}
let setItemImpl: (key: string, val: string) => void = (key, val) => { storage[key] = val }

beforeEach(() => {
  storage = {}
  setItemImpl = (key: string, val: string) => { storage[key] = val }
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => setItemImpl(key, val),
    removeItem: (key: string) => { delete storage[key] },
    clear: () => { storage = {} },
  })
})

describe('AbuCalendar P0 — createAppointmentSafe contract', () => {
  it('valid event → returns { ok: true, appointment } and persists it', () => {
    const r = createAppointmentSafe({
      title: 'רופא',
      date: '2026-05-15',
      time: '16:00',
      emoji: '🏥',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.appointment.id).toBeTruthy()
    expect(r.appointment.title).toBe('רופא')
    // Read-back verification — the event must actually be in storage.
    const fromStorage = loadAppointments().find((a) => a.id === r.appointment.id)
    expect(fromStorage).toBeDefined()
    expect(fromStorage?.title).toBe('רופא')
  })

  it('missing title → returns { ok: false, code: "missing_title" } and nothing persists', () => {
    const r = createAppointmentSafe({ title: '', date: '2026-05-15', time: '16:00', emoji: '📅' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('missing_title')
    expect(loadAppointments().length).toBe(0)
  })

  it('missing date → returns { ok: false, code: "missing_date" } and nothing persists', () => {
    const r = createAppointmentSafe({ title: 'רופא', date: '', time: '16:00', emoji: '📅' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('missing_date')
    expect(loadAppointments().length).toBe(0)
  })

  it('missing time → returns { ok: false, code: "missing_time" } and nothing persists', () => {
    const r = createAppointmentSafe({ title: 'רופא', date: '2026-05-15', time: '', emoji: '📅' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('missing_time')
    expect(loadAppointments().length).toBe(0)
  })

  it('malformed date (not YYYY-MM-DD) → returns { ok: false, code: "invalid_date" }', () => {
    const r = createAppointmentSafe({ title: 'רופא', date: 'tomorrow', time: '16:00', emoji: '📅' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('invalid_date')
  })

  it('malformed time (not HH:MM) → returns { ok: false, code: "invalid_time" }', () => {
    const r = createAppointmentSafe({ title: 'רופא', date: '2026-05-15', time: '4pm', emoji: '📅' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('invalid_time')
  })

  it('storage quota / disabled → returns { ok: false, code: "storage_failed" } honestly', () => {
    // Simulate the iOS Safari private-mode / quota path: setItem throws.
    setItemImpl = () => {
      throw new Error('QuotaExceededError')
    }
    const r = createAppointmentSafe({
      title: 'רופא', date: '2026-05-15', time: '16:00', emoji: '🏥',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('storage_failed')
  })

  it('round-trip verification: createAppointmentSafe reads back to confirm persistence', () => {
    // Writes succeed but are silently discarded (some hostile storage
    // shims do this). The function must read back and detect the loss.
    setItemImpl = () => { /* silent no-op */ }
    const r = createAppointmentSafe({
      title: 'רופא', date: '2026-05-15', time: '16:00', emoji: '🏥',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('storage_failed')
  })

  it('persistence survives a reload (same localStorage)', () => {
    const r = createAppointmentSafe({
      title: 'פגישה עם לאו', date: '2026-05-15', time: '10:00', emoji: '👨‍👩‍👧',
    })
    expect(r.ok).toBe(true)
    // Simulate reload by re-reading from storage.
    const after = loadAppointments()
    expect(after.length).toBe(1)
    expect(after[0]?.title).toBe('פגישה עם לאו')
  })

  it('corrupted storage on load does not crash', () => {
    localStorage.setItem('abubank-calendar-appointments', '{"not an array":true}')
    // Should return [] instead of throwing.
    expect(loadAppointments()).toEqual([])
  })
})

describe('AbuCalendar P0 — confirmation message includes specifics', () => {
  it('formatCreatedConfirmation builds a Hebrew message with title + date + time', () => {
    const msg = formatCreatedConfirmation(
      { title: 'רופא', date: '2026-05-15', time: '16:00' }, 'he',
    )
    expect(msg).toContain('רופא')
    expect(msg).toContain('16:00')
    // Reads "קבעתי" — not just "נשמר".
    expect(msg.startsWith('קבעתי')).toBe(true)
  })

  it('formatCreatedConfirmation Spanish includes "Listo, lo agendé"', () => {
    const msg = formatCreatedConfirmation(
      { title: 'reunión con Leo', date: '2026-05-15', time: '16:00' }, 'es',
    )
    expect(msg).toContain('Listo')
    expect(msg).toContain('Leo')
    expect(msg).toContain('16:00')
  })

  it('formatCreatedConfirmation English includes "Done, I added"', () => {
    const msg = formatCreatedConfirmation(
      { title: 'meeting with Gilad', date: '2026-05-15', time: '16:00' }, 'en',
    )
    expect(msg).toContain('Done')
    expect(msg).toContain('Gilad')
    expect(msg).toContain('16:00')
  })

  it('formatCreateFailure provides honest HE/ES/EN copy', () => {
    const he = formatCreateFailure('storage_failed', 'he')
    expect(he).toContain('לא הצלחתי')
    const es = formatCreateFailure('storage_failed', 'es')
    expect(es.toLowerCase()).toContain('no')
    const en = formatCreateFailure('storage_failed', 'en')
    expect(en.toLowerCase()).toContain("couldn't")
  })

  it('formatMissingFieldQuestion asks one clarifying question per missing field', () => {
    expect(formatMissingFieldQuestion('time', 'he')).toContain('שעה')
    expect(formatMissingFieldQuestion('date', 'he')).toContain('מתי')
    expect(formatMissingFieldQuestion('title', 'he')).toContain('מה')
    expect(formatMissingFieldQuestion('time', 'es').toLowerCase()).toContain('hora')
    expect(formatMissingFieldQuestion('time', 'en').toLowerCase()).toContain('time')
  })
})
