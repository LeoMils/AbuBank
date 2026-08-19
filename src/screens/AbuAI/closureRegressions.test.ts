/*
 * Regression locks for the non-mic green-closure fixes:
 *  - "מחרתיים" (day-after) must NOT route to calendar_tomorrow (wrong-day).
 *  - "מי ההורים של X" returns BOTH parents (inferred relation).
 *  - detectLanguage handles accented/plain Spanish ("gracias", "no sé qué hacer", "extraño a Pepe").
 *  - getProactiveSeed catches Spanish grief with words between ("extraño mucho a Pepe").
 *  - shapeFamilyAnswerES closes with correct gender ("él" for Leo) and no Hebrew location leak.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { routePersonalQuery } from './router'
import { tryGroundedAnswer } from './service'
import { detectLanguage, getProactiveSeed } from './proactive'
import { resolveRelationalQuery } from './relationalResolver'
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

describe('calendar: period-of-day read filter', () => {
  let storage: Record<string, string> = {}
  beforeEach(() => {
    storage = {}
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 5, 22))
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage[k] ?? null, setItem: (k: string, v: string) => { storage[k] = v }, removeItem: (k: string) => { delete storage[k] } })
    storage['abubank-calendar-appointments'] = JSON.stringify([
      { id: 'm', title: 'יוגה', date: '2026-06-23', time: '09:00', emoji: '🧘', color: '#1' },
      { id: 'a', title: 'רופא', date: '2026-06-23', time: '16:00', emoji: '🏥', color: '#2' },
    ])
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  it('"מחר בבוקר" → morning event only', () => {
    const a = tryGroundedAnswer('מה יש לי מחר בבוקר?')!
    expect(a).toContain('יוגה'); expect(a).not.toContain('רופא')
  })
  it('"מחר בערב" → empty (nothing after 17:00)', () => {
    const a = tryGroundedAnswer('מה יש לי מחר בערב?')!
    expect(a).toMatch(/אין כלום|שקט/)
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

describe('family role resolver: siblings / cousins / uncle / spouse (ה-prefix + plurals)', () => {
  it('"מי האח של אופיר" → his brothers (siblings)', () => {
    const a = tryGroundedAnswer('מי האח של אופיר?')
    expect(a).toBeTruthy(); expect(a).toContain('איילון')
  })
  it('"מי האחים של אופיר" → all siblings', () => {
    const a = tryGroundedAnswer('מי האחים של אופיר?')
    expect(a).toContain('איילון'); expect(a).toContain('אדר')
  })
  it('"מי בן הדוד של עדי" → male cousins (Mor\'s sons; Ofir is a female cousin)', () => {
    const a = tryGroundedAnswer('מי בן הדוד של עדי?')
    expect(a).toBeTruthy(); expect(a).toContain('איילון')
    expect(a).not.toContain('אופיר')  // Ofir is בת דודה (female), not בן דוד
  })
  it('"מי הדוד של אופיר" → uncle Leo', () => {
    expect(tryGroundedAnswer('מי הדוד של אופיר?')).toContain('לאו')
  })
  it('"מי האישה של עילי" → wife Yarden', () => {
    expect(tryGroundedAnswer('מי האישה של עילי?')).toContain('ירדן')
  })
  it('non-existent relation declines honestly, never invents (Ofir has no sister)', () => {
    const a = tryGroundedAnswer('מי האחות של אופיר?')
    expect(a).toMatch(/לא יודעת/)
    expect(/הבת שלך|הנכדה שלך/.test(a ?? '')).toBe(false)
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

describe('Spanish plural relations + loneliness adverbs', () => {
  it('"los hijos de Mor" → plural children with "son" agreement', () => {
    const a = resolveRelationalQuery('¿quiénes son los hijos de Mor?', 'es')
    expect(a).toBeTruthy()
    expect(a).toMatch(/son /)
    expect(a).toContain('Ofir')
    expect(/[֐-׿]/.test(a ?? '')).toBe(false)
  })
  it('"los nietos de Abu" → grandchildren', () => {
    const a = resolveRelationalQuery('los nietos de Abu', 'es')
    expect(a).toContain('Adi'); expect(a).toContain('Ofir')
  })
  it('"me siento muy sola" is caught as loneliness (Spanish seed)', () => {
    const s = getProactiveSeed('me siento muy sola', {})
    expect(s).not.toBeNull()
    expect(/[֐-׿]/.test(s!.text)).toBe(false)
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
