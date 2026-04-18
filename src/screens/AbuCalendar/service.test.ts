import { describe, it, expect } from 'vitest'
import {
  detectEmoji,
  formatHebrewDate,
  formatShortHebrewDate,
  FAMILY_BIRTHDAYS,
  FAMILY_MEMORIALS,
} from './service'

describe('detectEmoji', () => {
  it('returns hospital emoji for doctor-related text', () => {
    expect(detectEmoji('פגישה עם הרופא')).toBe('🏥')
    expect(detectEmoji('doctor appointment')).toBe('🏥')
  })

  it('returns scissors emoji for haircut text', () => {
    expect(detectEmoji('תספורת')).toBe('✂️')
  })

  it('returns birthday emoji for birthday text', () => {
    expect(detectEmoji('יום הולדת של מור')).toBe('🎂')
  })

  it('returns calendar emoji for generic text', () => {
    expect(detectEmoji('פגישה בשלוש')).toBe('📅')
  })
})

describe('formatHebrewDate', () => {
  it('formats a valid date in Hebrew', () => {
    const result = formatHebrewDate('2026-04-11')
    expect(result).toContain('11')
    expect(result).toContain('אפריל')
    expect(result).toContain('2026')
  })

  it('returns raw string for invalid date', () => {
    expect(formatHebrewDate('bad')).toBe('bad')
  })
})

describe('formatShortHebrewDate', () => {
  it('formats date with day name and month', () => {
    const result = formatShortHebrewDate('2026-04-11')
    expect(result).toContain('11')
    expect(result).toContain('אפריל')
    expect(result).toContain('שבת')
  })

  it('returns raw string for invalid date', () => {
    expect(formatShortHebrewDate('xyz')).toBe('xyz')
  })
})

describe('FAMILY_BIRTHDAYS', () => {
  it('has at least 10 family members', () => {
    expect(FAMILY_BIRTHDAYS.length).toBeGreaterThanOrEqual(10)
  })

  it('every birthday has personName', () => {
    for (const bday of FAMILY_BIRTHDAYS) {
      expect(bday.personName).toBeTruthy()
    }
  })

  it('no birthday title duplicates "יום הולדת" in personName', () => {
    for (const bday of FAMILY_BIRTHDAYS) {
      // personName should be just the name, not "יום הולדת X"
      expect(bday.personName).not.toContain('יום הולדת')
    }
  })

  it('all dates are valid MM-DD format', () => {
    for (const bday of FAMILY_BIRTHDAYS) {
      const mmdd = bday.date.slice(5) // "MM-DD"
      expect(mmdd).toMatch(/^\d{2}-\d{2}$/)
    }
  })
})

describe('FAMILY_MEMORIALS', () => {
  it('has at least one memorial', () => {
    expect(FAMILY_MEMORIALS.length).toBeGreaterThanOrEqual(1)
  })

  it('Pepe memorial has correct type', () => {
    const pepe = FAMILY_MEMORIALS.find(m => m.personName === 'פפי')
    expect(pepe).toBeDefined()
    expect(pepe?.type).toBe('memory')
    expect(pepe?.isRecurring).toBe(true)
  })
})
