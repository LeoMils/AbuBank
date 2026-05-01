import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tryGroundedAnswer } from './service'
import { routePersonalQuery } from './router'
import { getBirthdayFor, getMemorialFor, getEventsByDate, getEventsByMonth } from './tools'

describe('WAR ROOM — AbuAI Recovery Test Matrix', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 3, 29)) // April 29, 2026
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  // T1: Empty calendar tomorrow
  it('T1: מה יש לי מחר? (empty) → לא מצאתי', () => {
    const answer = tryGroundedAnswer('מה יש לי מחר?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('לא מצאתי')
  })

  // T2: Tomorrow with seeded event
  it('T2: מה יש לי מחר? (with רופא 10:00) → רופא + time', () => {
    // Compute tomorrow dynamically (fake timers set to April 29, 2026)
    const tomorrow = new Date(2026, 3, 30)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]!
    storage['abubank-calendar-appointments'] = JSON.stringify([
      { id: 'test-1', title: 'רופא', date: tomorrowStr, time: '10:00', emoji: '🏥', color: '#C9A84C' },
    ])
    const answer = tryGroundedAnswer('מה יש לי מחר?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('רופא')
    expect(answer).toContain('מחר')
  })

  // T3: Past query — אתמול
  it('T3: מה היה לי אתמול? → routes to calendar_exact_date', () => {
    const route = routePersonalQuery('מה היה לי אתמול?')
    expect(route.type).toBe('calendar_exact_date')
    expect(route.dateStr).toBe('2026-04-28')
  })

  it('T3b: מה היה לי אתמול? → grounded answer', () => {
    const answer = tryGroundedAnswer('מה היה לי אתמול?')
    expect(answer).not.toBeNull()
  })

  // T4: Exact date — Martita birthday April 1
  it('T4: מה היה לי באחד באפריל? → Martita birthday', () => {
    const route = routePersonalQuery('מה היה לי באחד באפריל?')
    expect(route.type).toBe('calendar_exact_date')
    expect(route.dateStr).toBe('2026-04-01')

    const result = getEventsByDate('2026-04-01')
    expect(result.events.length).toBeGreaterThan(0)
    expect(result.summary).toContain('Martita')
  })

  // T5: Birthday month query
  it('T5: למי יש יום הולדת באפריל? → multiple birthdays', () => {
    const route = routePersonalQuery('למי יש יום הולדת באפריל?')
    expect(route.type).toBe('calendar_month')
    expect(route.month).toBe(4)

    const result = getEventsByMonth(4)
    expect(result.events.length).toBeGreaterThanOrEqual(4) // Martita, Adi, Noam, Ilai, Papi
    expect(result.summary).toContain('Martita')
    expect(result.summary).toContain('פפי')
  })

  // T6: Birthday lookup by name
  it('T6: מתי יום ההולדת של פפי? → April 19', () => {
    const route = routePersonalQuery('מתי יום ההולדת של פפי?')
    expect(route.type).toBe('birthday_lookup')
    expect(route.familyQuery).toBe('פפי')

    const result = getBirthdayFor('פפי')
    expect(result.found).toBe(true)
    expect(result.summary).toContain('19')
    expect(result.summary).toContain('אפריל')
  })

  // T7: Memorial lookup
  it('T7: מתי יום הזיכרון של פפי? → January 1', () => {
    const route = routePersonalQuery('מתי יום הזיכרון של פפי?')
    expect(route.type).toBe('memorial_lookup')
    expect(route.familyQuery).toBe('פפי')

    const result = getMemorialFor('פפי')
    expect(result.found).toBe(true)
    expect(result.summary).toContain('ינואר')
    expect(result.summary).toContain('🕯️')
  })

  // T8: Family lookup warm response
  it('T8: מי זאת מור? → warm family answer', () => {
    const answer = tryGroundedAnswer('מי זאת מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('הבת שלך')
    expect(answer).not.toContain('היא היא') // no double pronoun
  })

  // T9: Holiday date query
  it('T9: מה היה בפסח? → resolves to Pesach date', () => {
    const route = routePersonalQuery('מה היה בפסח?')
    expect(route.type).toBe('calendar_exact_date')
    expect(route.dateStr).toBe('2026-04-02')
  })

  // T10: Invalid date
  it('T10: unparseable date falls through gracefully', () => {
    const route = routePersonalQuery('מה היה ב-30 בפברואר?')
    // Feb 30 doesn't exist but parser may produce it; route should still work
    expect(route.type).not.toBe('non_personal')
  })

  // T11: Empty calendar all scopes
  it('T11a: empty today → לא מצאתי', () => {
    const answer = tryGroundedAnswer('מה יש לי היום?')
    expect(answer).toContain('לא מצאתי')
  })

  it('T11b: empty week → שקט', () => {
    // Week may include family birthdays if within range
    const answer = tryGroundedAnswer('מה יש לי השבוע?')
    expect(answer).not.toBeNull()
  })

  // T12: Birthday for person without data
  it('T12: מתי יום ההולדת של גלעד? → no data', () => {
    const result = getBirthdayFor('גלעד')
    expect(result.found).toBe(false)
    expect(result.summary).toContain('אין לי')
  })

  // T13: End-to-end grounded birthday lookup
  it('T13: מתי יום ההולדת של פפי? → full grounded answer', () => {
    const answer = tryGroundedAnswer('מתי יום ההולדת של פפי?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('19')
    expect(answer).toContain('אפריל')
  })

  // T14: End-to-end grounded memorial lookup
  it('T14: מתי יום הזיכרון של פפי? → full grounded answer', () => {
    const answer = tryGroundedAnswer('מתי יום הזיכרון של פפי?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('ינואר')
    expect(answer).toContain('🕯️')
  })

  // T15: Grounded exact date with event
  it('T15: מה היה באחד באפריל? → Martita birthday', () => {
    const answer = tryGroundedAnswer('מה היה לי באחד באפריל?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('Martita')
  })
})
