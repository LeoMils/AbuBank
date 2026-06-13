/*
 * Regression tests for exact real-demo failures reported by Leo.
 * Each test reproduces a specific failure from the iPhone Vercel demo.
 */

import { describe, it, expect } from 'vitest'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { isCancel, parseHebrewTimeDetailed } from './calendarCreate'

describe('Demo failure: "זה כבר ביומן?" must NOT cancel', () => {
  it('"וזה כבר בתוך היומן שלי?" is NOT a cancel', () => {
    expect(isCancel('וזה כבר בתוך היומן שלי?')).toBe(false)
  })

  it('"זה כבר ביומן?" routes to calendar, not non_personal', () => {
    const route = routePersonalQuery('זה כבר ביומן?')
    expect(route.type).toMatch(/^calendar_/)
  })

  it('"נרשם ביומן?" routes to calendar', () => {
    const route = routePersonalQuery('נרשם ביומן?')
    expect(route.type).toMatch(/^calendar_/)
  })

  it('"מה קבענו?" routes to calendar', () => {
    const route = routePersonalQuery('מה קבענו?')
    expect(route.type).toMatch(/^calendar_/)
  })
})

describe('Demo failure: "בשעה שלוש" must not silently choose 03:00', () => {
  it('"בשעה 3" (numeric) applies period logic, not raw 03:00', () => {
    const result = parseHebrewTimeDetailed('בשעה 3')
    // Hours 1-6 default to PM (15:00) — the ambiguous flag may vary
    // but it must NOT be 03:00
    expect(result.time).not.toBe('03:00')
  })

  it('"בשעה שלוש" (word) defaults to 15:00 for hours 1-6', () => {
    const result = parseHebrewTimeDetailed('בשעה שלוש')
    expect(result.time).toBe('15:00')
    expect(result.ambiguous).toBe(false) // 1-6 default PM
  })

  it('"בשעה שלוש בלילה" explicitly = 03:00', () => {
    // Only "בלילה" should produce 03:00
    const result = parseHebrewTimeDetailed('בשעה שלוש בלילה')
    expect(result.time).toBe('03:00')
  })

  it('"בשעה שלוש אחר הצהריים" = 15:00', () => {
    const result = parseHebrewTimeDetailed('בשעה שלוש אחר הצהריים')
    expect(result.time).toBe('15:00')
  })
})

describe('Demo failure: past calendar queries must route locally', () => {
  it('"מה היה לי שבוע שעבר?" routes to calendar', () => {
    const route = routePersonalQuery('מה היה לי שבוע שעבר?')
    expect(route.type).toMatch(/^calendar_/)
  })

  it('"מה היה לי השנה?" routes to calendar', () => {
    const route = routePersonalQuery('מה היה לי השנה?')
    expect(route.type).toMatch(/^calendar_/)
  })

  it('"מה היה לי החודש?" routes to calendar', () => {
    const route = routePersonalQuery('מה היה לי החודש?')
    expect(route.type).toMatch(/^calendar_/)
  })
})

describe('Demo failure: general knowledge must route to LLM', () => {
  it('"מה הייתה המהפכה הצרפתית?" → non_personal (LLM)', () => {
    const route = routePersonalQuery('מה הייתה המהפכה הצרפתית?')
    expect(route.type).toBe('non_personal')
  })

  it('"ספרי לי פרטים" → non_personal (LLM)', () => {
    const route = routePersonalQuery('ספרי לי פרטים')
    expect(route.type).toBe('non_personal')
  })

  it('"מתי יוצא יום העצמאות?" → non_personal (LLM handles holidays)', () => {
    const route = routePersonalQuery('מתי יוצא יום העצמאות?')
    expect(route.type).toBe('non_personal')
  })
})
