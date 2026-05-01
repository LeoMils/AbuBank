import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseHebrewDate, parseHebrewMonth } from './dateParser'

// Mock today as 2026-04-29 for deterministic tests
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 3, 29)) // April 29, 2026
})

describe('parseHebrewDate', () => {
  describe('relative dates', () => {
    it('אתמול → yesterday', () => {
      expect(parseHebrewDate('מה היה לי אתמול?')).toBe('2026-04-28')
    })

    it('שלשום → day before yesterday', () => {
      expect(parseHebrewDate('מה היה לי שלשום')).toBe('2026-04-27')
    })
  })

  describe('numeric day + Hebrew month', () => {
    it('ב-1 באפריל', () => {
      expect(parseHebrewDate('מה היה ב-1 באפריל')).toBe('2026-04-01')
    })

    it('ב-15 למאי', () => {
      expect(parseHebrewDate('מה יש ב-15 למאי')).toBe('2026-05-15')
    })

    it('ב-28 בפברואר', () => {
      expect(parseHebrewDate('מה היה ב-28 בפברואר')).toBe('2026-02-28')
    })

    it('ב-3 באוגוסט', () => {
      expect(parseHebrewDate('ב-3 באוגוסט')).toBe('2026-08-03')
    })
  })

  describe('Hebrew word day + month', () => {
    it('באחד באפריל', () => {
      expect(parseHebrewDate('מה היה לי באחד באפריל')).toBe('2026-04-01')
    })

    it('בחמישה במאי', () => {
      expect(parseHebrewDate('בחמישה במאי')).toBe('2026-05-05')
    })

    it('בעשרים ואחד ביוני', () => {
      expect(parseHebrewDate('בעשרים ואחד ביוני')).toBe('2026-06-21')
    })

    it('בשלושים באוגוסט', () => {
      expect(parseHebrewDate('בשלושים באוגוסט')).toBe('2026-08-30')
    })

    it('בעשר בינואר', () => {
      expect(parseHebrewDate('בעשר בינואר')).toBe('2026-01-10')
    })
  })

  describe('holidays', () => {
    it('בפסח → first Pesach date in 2026', () => {
      expect(parseHebrewDate('מה היה בפסח?')).toBe('2026-04-02')
    })

    it('בפורים → Purim date in 2026', () => {
      expect(parseHebrewDate('מה היה בפורים?')).toBe('2026-03-03')
    })

    it('בחנוכה → first Chanukah date in 2026', () => {
      expect(parseHebrewDate('מה יש בחנוכה?')).toBe('2026-12-05')
    })

    it('בראש השנה → Rosh Hashana 2026', () => {
      expect(parseHebrewDate('מה יש בראש השנה?')).toBe('2026-09-22')
    })
  })

  describe('unparseable', () => {
    it('general question returns null', () => {
      expect(parseHebrewDate('מה דעתך על פוליטיקה?')).toBeNull()
    })

    it('empty string returns null', () => {
      expect(parseHebrewDate('')).toBeNull()
    })

    it('invalid month returns null', () => {
      expect(parseHebrewDate('ב-5 בקיץ')).toBeNull()
    })
  })
})

describe('parseHebrewMonth', () => {
  it('באפריל → 4', () => {
    expect(parseHebrewMonth('למי יש יום הולדת באפריל')).toBe(4)
  })

  it('במרץ → 3', () => {
    expect(parseHebrewMonth('מה היה במרץ')).toBe(3)
  })

  it('דצמבר → 12', () => {
    expect(parseHebrewMonth('מה יש בדצמבר')).toBe(12)
  })

  it('no month → null', () => {
    expect(parseHebrewMonth('מה יש לי מחר')).toBeNull()
  })
})
