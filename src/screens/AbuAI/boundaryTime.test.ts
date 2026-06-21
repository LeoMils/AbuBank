import { describe, it, expect } from 'vitest'
import { parseQueryBoundaryTime } from './service'

describe('L-4 bare-word / bare-digit time after לפני / אחרי', () => {
  it('bare digits', () => {
    expect(parseQueryBoundaryTime('מה יש לי אחרי 5')).toBe('17:00')   // 1-6 → PM convention
    expect(parseQueryBoundaryTime('מה יש לי לפני 10')).toBe('10:00')  // 7-12 → AM
    expect(parseQueryBoundaryTime('מה יש לי לפני 12')).toBe('12:00')
    expect(parseQueryBoundaryTime('מה יש לי מחר אחרי 5')).toBe('17:00')
    expect(parseQueryBoundaryTime('מה יש לי היום אחרי חמש')).toBe('17:00')
  })
  it('Hebrew word numbers + period', () => {
    expect(parseQueryBoundaryTime('מה יש לי אחרי שבע בערב')).toBe('19:00')
    expect(parseQueryBoundaryTime('מה יש לי אחרי חמש')).toBe('17:00')
    expect(parseQueryBoundaryTime('מה יש לי לפני עשר')).toBe('10:00')
  })
  it('period phrases (noon)', () => {
    expect(parseQueryBoundaryTime('מה יש לי לפני הצהריים')).toBe('12:00')
    expect(parseQueryBoundaryTime('מה יש לי אחרי הצהריים')).toBe('12:00')
  })
  it('explicit times still parse (exact path preserved)', () => {
    expect(parseQueryBoundaryTime('מה יש לי בארבע')).toBe('16:00')
    expect(parseQueryBoundaryTime('מה יש לי אחרי 10:00')).toBe('10:00')
    expect(parseQueryBoundaryTime('מה יש לי לפני 16:00')).toBe('16:00')
  })
  it('no time mentioned → null (no false filter)', () => {
    expect(parseQueryBoundaryTime('מה יש לי מחר')).toBeNull()
    expect(parseQueryBoundaryTime('מה יש לי היום')).toBeNull()
  })
})
