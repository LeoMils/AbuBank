/*
 * Regression locks for the non-mic green-closure fixes:
 *  - "מחרתיים" (day-after) must NOT route to calendar_tomorrow (wrong-day).
 *  - "מי ההורים של X" returns BOTH parents (inferred relation).
 *  - detectLanguage handles accented/plain Spanish ("gracias", "no sé qué hacer", "extraño a Pepe").
 *  - getProactiveSeed catches Spanish grief with words between ("extraño mucho a Pepe").
 *  - shapeFamilyAnswerES closes with correct gender ("él" for Leo) and no Hebrew location leak.
 */
import { describe, it, expect } from 'vitest'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { detectLanguage, getProactiveSeed } from './proactive'
import { shapeFamilyAnswerES } from './responseShaper'
import { loadFamilyData } from '../../services/familyLoader'

describe('calendar: no wrong-day on מחרתיים', () => {
  it('"מה יש לי מחרתיים" does not route to calendar_tomorrow', () => {
    expect(routePersonalQuery('מה יש לי מחרתיים?').type).not.toBe('calendar_tomorrow')
  })
  it('"מה יש לי מחר" still routes to calendar_tomorrow', () => {
    expect(routePersonalQuery('מה יש לי מחר?').type).toBe('calendar_tomorrow')
  })
})

describe('family: plural parents inferred', () => {
  it('"מי ההורים של ארי" returns both parents (Ofir + Gilad)', () => {
    const a = tryGroundedAnswer('מי ההורים של ארי?')
    expect(a).toBeTruthy()
    expect(a).toContain('אופיר')
    expect(a).toContain('גלעד')
  })
})

describe('language detection: Spanish', () => {
  it('detects plain and accented Spanish', () => {
    expect(detectLanguage('gracias')).toBe('es')
    expect(detectLanguage('no sé qué hacer')).toBe('es')
    expect(detectLanguage('extraño a Pepe')).toBe('es')
    expect(detectLanguage('charlemos')).toBe('es')
  })
  it('still detects Hebrew', () => {
    expect(detectLanguage('משעמם לי')).toBe('he')
  })
})

describe('proactive: Spanish grief with words between', () => {
  it('"extraño mucho a Pepe" returns a Spanish Pepe seed', () => {
    const s = getProactiveSeed('extraño mucho a Pepe', {})
    expect(s).not.toBeNull()
    expect(s!.text).toMatch(/Pepe/)
    expect(/[֐-׿]/.test(s!.text)).toBe(false)
  })
})

describe('Spanish family answer: gender + no Hebrew location leak', () => {
  it('Leo (male) closes with "él", not "ella"; no Hebrew in the answer', () => {
    const leo = loadFamilyData().find((m) => m.canonicalName === 'Leo')!
    const a = shapeFamilyAnswerES(leo, true)
    expect(a).toContain('con él')
    expect(a).not.toContain('con ella')
    expect(/[֐-׿]/.test(a)).toBe(false)
  })
  it('a located member renders the city in Latin (no Hebrew leak)', () => {
    const mor = loadFamilyData().find((m) => m.canonicalName === 'Mor')!
    const a = shapeFamilyAnswerES(mor, true)
    expect(/[֐-׿]/.test(a)).toBe(false)
  })
})
