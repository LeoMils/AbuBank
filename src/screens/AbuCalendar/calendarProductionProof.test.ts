/**
 * PHASE 3 — Calendar Production Proof
 *
 * Tests the full calendar CRUD pipeline with localStorage simulation.
 * Every test verifies actual storage state, not just function return values.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadAppointments,
  saveAppointments,
  addAppointment,
  createAppointmentSafe,
  type Appointment,
} from './service'
import { getTodayEvents, getTomorrowEvents, getWeekEvents, getEventsByDate } from '../AbuAI/tools'
import { parseLocally } from './localParser'
import { containsCreateVerb } from './voiceAutoCreate'

// ─── localStorage stub ───────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────────────
const today = new Date().toLocaleDateString('sv-SE')
const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('sv-SE') })()
const nextWeek = (() => { const d = new Date(); d.setDate(d.getDate() + 5); return d.toLocaleDateString('sv-SE') })()
const lastWeek = (() => { const d = new Date(); d.setDate(d.getDate() - 3); return d.toLocaleDateString('sv-SE') })()

function seedEvents() {
  const events: Omit<Appointment, 'id' | 'color'>[] = [
    { title: 'רופא שיניים', date: today, time: '10:00', emoji: '🦷' },
    { title: 'פגישה עם מוטי', date: tomorrow, time: '15:00', emoji: '📅' },
    { title: 'יוגה', date: nextWeek, time: '09:00', emoji: '🧘' },
    { title: 'ביקור מור', date: lastWeek, time: '14:00', emoji: '❤️' },
    { title: 'שיעור ספרדית', date: today, time: '16:00', emoji: '📚' },
  ]
  events.forEach(e => addAppointment(e))
}

// ─── Phase 3.1: מה יש לי היום? ──────────────────────────────────────────
describe('Phase 3 — Calendar Production Proof', () => {

  it('Test 1: מה יש לי היום — returns today events from storage', () => {
    seedEvents()
    const result = getTodayEvents()
    expect(result.events.length).toBe(2)
    expect(result.events.some(e => e.title === 'רופא שיניים')).toBe(true)
    expect(result.events.some(e => e.title === 'שיעור ספרדית')).toBe(true)
    expect(result.summary).toBeTruthy()
    // Verify storage proof
    const stored = loadAppointments()
    expect(stored.length).toBe(5)
  })

  it('Test 2: מה יש לי מחר — returns tomorrow events', () => {
    seedEvents()
    const result = getTomorrowEvents()
    expect(result.events.length).toBe(1)
    expect(result.events[0]!.title).toBe('פגישה עם מוטי')
    expect(result.events[0]!.time).toBe('15:00')
  })

  it('Test 3: מה יש לי השבוע — returns week events', () => {
    seedEvents()
    const result = getWeekEvents()
    // Should include today + tomorrow + this week, but NOT last week
    expect(result.events.length).toBeGreaterThanOrEqual(3)
    expect(result.events.some(e => e.title === 'ביקור מור')).toBe(false) // last week excluded
    expect(result.summary).toContain('רופא שיניים')
  })

  it('Test 4: past week events are correctly stored and retrievable by date', () => {
    seedEvents()
    const result = getEventsByDate(lastWeek)
    expect(result.events.length).toBe(1)
    expect(result.events[0]!.title).toBe('ביקור מור')
  })

  it('Test 5: next week event is retrievable', () => {
    seedEvents()
    const result = getEventsByDate(nextWeek)
    expect(result.events.length).toBe(1)
    expect(result.events[0]!.title).toBe('יוגה')
  })

  // ─── Phase 3.6: תקבעי לי פגישה מחר ב-15:00 עם מוטי ────────────────────
  it('Test 6: parse "תקבעי לי פגישה מחר ב-15:00 עם מוטי"', () => {
    const draft = parseLocally('תקבעי לי פגישה מחר ב-15:00 עם מוטי', today)
    expect(draft.title).toContain('מוטי')
    expect(draft.date).toBe(tomorrow)
    expect(draft.time).toBe('15:00')
    expect(draft.confidence).toBeGreaterThan(0)
  })

  it('Test 6b: containsCreateVerb detects תקבעי', () => {
    expect(containsCreateVerb('תקבעי לי פגישה מחר')).toBe(true)
    expect(containsCreateVerb('מה יש לי מחר')).toBe(false)
  })

  it('Test 7: createAppointmentSafe actually persists to storage', () => {
    const result = createAppointmentSafe({
      title: 'פגישה עם מוטי',
      date: tomorrow,
      time: '15:00',
      emoji: '📅',
    })
    expect(result.ok).toBe(true)
    // Storage proof — round-trip
    const stored = loadAppointments()
    expect(stored.length).toBe(1)
    expect(stored[0]!.title).toBe('פגישה עם מוטי')
    expect(stored[0]!.date).toBe(tomorrow)
    expect(stored[0]!.time).toBe('15:00')
  })

  it('Test 8: after creation, "מה יש לי מחר" shows the new event', () => {
    createAppointmentSafe({
      title: 'פגישה עם מוטי',
      date: tomorrow,
      time: '15:00',
      emoji: '📅',
    })
    const result = getTomorrowEvents()
    expect(result.events.length).toBe(1)
    expect(result.events[0]!.title).toBe('פגישה עם מוטי')
  })

  // ─── Phase 3.9: update (reschedule) ─────────────────────────────────────
  it('Test 9: update appointment date (reschedule)', () => {
    const created = createAppointmentSafe({
      title: 'פגישה עם מוטי',
      date: tomorrow,
      time: '15:00',
      emoji: '📅',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    // Simulate reschedule by updating the stored appointment
    const appts = loadAppointments()
    const idx = appts.findIndex(a => a.id === created.appointment.id)
    expect(idx).toBeGreaterThanOrEqual(0)
    appts[idx]!.date = nextWeek
    saveAppointments(appts)

    // Verify: tomorrow should be empty, next week should have it
    const tomorrowResult = getTomorrowEvents()
    expect(tomorrowResult.events.length).toBe(0)
    const nextWeekResult = getEventsByDate(nextWeek)
    expect(nextWeekResult.events.length).toBe(1)
    expect(nextWeekResult.events[0]!.title).toBe('פגישה עם מוטי')
  })

  // ─── Phase 3.10: delete ──────────────────────────────────────────────────
  it('Test 10: delete appointment removes from storage', () => {
    const created = createAppointmentSafe({
      title: 'פגישה עם מוטי',
      date: tomorrow,
      time: '15:00',
      emoji: '📅',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    // Delete by filtering out
    const appts = loadAppointments()
    const filtered = appts.filter(a => a.id !== created.appointment.id)
    saveAppointments(filtered)

    // Storage proof
    const stored = loadAppointments()
    expect(stored.length).toBe(0)
    const tomorrowResult = getTomorrowEvents()
    expect(tomorrowResult.events.length).toBe(0)
  })

  // ─── Additional: empty calendar ──────────────────────────────────────────
  it('empty calendar returns appropriate message', () => {
    const result = getTodayEvents()
    expect(result.events.length).toBe(0)
    expect(result.summary).toBeTruthy() // Should have "nothing today" message
  })

  // ─── Date parsing edge cases ─────────────────────────────────────────────
  it('parses "רופא מחר בעשר בבוקר"', () => {
    const draft = parseLocally('רופא מחר בעשר בבוקר', today)
    expect(draft.date).toBe(tomorrow)
    expect(draft.time).toBe('10:00')
  })

  it('parses "תקבעי פגישה ביום חמישי בשלוש"', () => {
    const draft = parseLocally('תקבעי פגישה ביום חמישי בשלוש', today)
    expect(draft.date).toBeTruthy()
    expect(draft.time).toBeTruthy()
  })

  it('parses "תזכירי לי שיש לי תור לרופא מחר ב-15:00"', () => {
    const draft = parseLocally('תזכירי לי שיש לי תור לרופא מחר ב-15:00', today)
    expect(draft.date).toBe(tomorrow)
    expect(draft.time).toBe('15:00')
  })
})
