/*
 * P4 · calendar state-machine audit (intake-rebuild). Full journeys as ONE flow —
 * create → query → edit → delete → recreate — proving every step round-trips through
 * the real store. Multiple meetings with the SAME person are allowed. Titles carry
 * the RESOLVED name. Plus a STANDING capability-denial probe: a "can't do it" phrase
 * on an existing calendar path is a hard failure.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest'
import { addAppointment, loadAppointments, updateAppointment, deleteAppointment } from '../AbuCalendar/service'
import { findEventsByPerson } from './tools'
import { calendarReadReasoner, calendarSearchReasoner } from './cognitiveRuntime'
import { deleteReasoner, modifyReasoner } from './calendarMutationReasoner'
import { parseCreateIntent } from './calendarCreate'

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const FIXED = new Date('2026-07-20T09:00:00') // Monday
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })

let storage: Record<string, string> = {}
beforeEach(() => {
  storage = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => { storage[k] = v },
    removeItem: (k: string) => { delete storage[k] },
  })
})

describe('P4 · full calendar journey round-trips through the store', () => {
  it('multiple meetings with the SAME person are allowed and stay distinguishable', () => {
    addAppointment({ title: 'פגישה עם מור', date: '2026-07-21', time: '15:00', emoji: '📅', personName: 'מור' })
    addAppointment({ title: 'פגישה עם מור', date: '2026-07-23', time: '10:00', emoji: '📅', personName: 'מור' })
    const r = findEventsByPerson('מור', true) // meetingOnly → excludes her birthday
    expect(r.events.length).toBe(2)
    expect(new Set(r.events.map((e) => e.date)).size).toBe(2) // two distinct events, not collapsed
  })

  it('create (RESOLVED title) → readback → edit → delete → recreate', () => {
    // create — the relation phrase resolves; the stored title carries the real name.
    const p = parseCreateIntent('תקבע לי פגישה עם החתן של מור מחר בשלוש')!
    expect(p.draft.title).toContain('גלעד')
    const saved = addAppointment({ title: p.draft.title!, date: p.draft.date!, time: p.draft.time ?? '15:00', emoji: '📅', personName: 'גלעד' })

    // query / readback
    expect(loadAppointments().find((a) => a.id === saved.id)?.title).toContain('גלעד')
    expect(findEventsByPerson('גלעד').events.length).toBe(1)

    // edit — the change persists (round-trip)
    updateAppointment(saved.id, { time: '16:00' })
    expect(loadAppointments().find((a) => a.id === saved.id)?.time).toBe('16:00')

    // delete — gone from the store
    deleteAppointment(saved.id)
    expect(loadAppointments().find((a) => a.id === saved.id)).toBeUndefined()
    expect(findEventsByPerson('גלעד').events.length).toBe(0)

    // recreate — a fresh event with the same person is created again (not blocked)
    const again = addAppointment({ title: p.draft.title!, date: p.draft.date!, time: '15:00', emoji: '📅', personName: 'גלעד' })
    expect(loadAppointments().find((a) => a.id === again.id)).toBeDefined()
    expect(again.id).not.toBe(saved.id)
  })
})

describe('P4 · standing capability-denial probe (a denial on an existing path is a HARD failure)', () => {
  const DENIAL = /לא\s+יכולה|אי\s+אפשר|לא\s+ניתן|אין\s+לי\s+אפשרות|לא\s+מסוגלת|can'?t|cannot|unable/iu

  it('read / search / edit / delete paths never emit a capability-denial', () => {
    const today = new Date()
    addAppointment({ title: 'פגישה עם מור', date: isoDay(today), time: '15:00', emoji: '📅', personName: 'מור' })
    const outputs = [
      calendarReadReasoner('מה יש לי היום', today),
      calendarSearchReasoner('מתי הפגישה עם מור'),
      deleteReasoner('תבטלי את הפגישה עם מור', { focusPerson: 'מור' }).text,
      modifyReasoner('תשני את הפגישה עם מור לארבע', { focusPerson: 'מור' }).text,
    ]
    for (const o of outputs) {
      expect(o.length).toBeGreaterThan(0)
      expect(o).not.toMatch(DENIAL)
    }
  })

  it('an empty calendar answers honestly (no data) — still not a capability denial', () => {
    const out = calendarReadReasoner('מה יש לי היום', new Date())
    expect(out).not.toMatch(DENIAL) // "אין כלום ביומן" is fine; "לא יכולה" is not
  })
})
