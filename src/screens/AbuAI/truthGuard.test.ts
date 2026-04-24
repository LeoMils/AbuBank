import { describe, it, expect } from 'vitest'
import { isPersonalQuery, containsUngroundedClaim } from './service'

describe('isPersonalQuery — expanded detection', () => {
  it('detects standard calendar questions', () => {
    expect(isPersonalQuery('מה יש לי מחר')).toBe(true)
    expect(isPersonalQuery('מתי יש לי רופא')).toBe(true)
    expect(isPersonalQuery('מה קורה היום')).toBe(true)
    expect(isPersonalQuery('מה יש לי השבוע')).toBe(true)
  })

  it('detects indirect calendar questions', () => {
    expect(isPersonalQuery('צריך לקום מוקדם מחר?')).toBe(true)
    expect(isPersonalQuery('יש לי יום עמוס?')).toBe(true)
    expect(isPersonalQuery('אני פנוי השבוע?')).toBe(true)
    expect(isPersonalQuery('מה יש שבוע הבא')).toBe(true)
  })

  it('detects family questions', () => {
    expect(isPersonalQuery('מי זו מור')).toBe(true)
    expect(isPersonalQuery('ספרי לי על אופיר')).toBe(true)
    expect(isPersonalQuery('מה המספר טלפון של לאו')).toBe(true)
  })

  it('does NOT flag general questions', () => {
    expect(isPersonalQuery('מה זה בינה מלאכותית')).toBe(false)
    expect(isPersonalQuery('ספרי לי על איטליה')).toBe(false)
    expect(isPersonalQuery('מה מזג האוויר')).toBe(false)
  })
})

describe('containsUngroundedClaim — truth guard', () => {
  it('allows grounded response (had tool call)', () => {
    expect(containsUngroundedClaim('יש לך תור רופא ב-10:00', true)).toBe(false)
  })

  it('blocks calendar claim without tool call', () => {
    expect(containsUngroundedClaim('יש לך תור רופא מחר', false)).toBe(true)
    expect(containsUngroundedClaim('אני רואה שיש לך פגישה', false)).toBe(true)
    expect(containsUngroundedClaim('אני רואה ביומן שלך פגישה', false)).toBe(true)
    expect(containsUngroundedClaim('לפי היומן יש לך בדיקה', false)).toBe(true)
  })

  it('blocks invented time patterns without tool call', () => {
    expect(containsUngroundedClaim('יש לך ב-14:30 רופא', false)).toBe(true)
    expect(containsUngroundedClaim('יש לך ביום שלישי פגישה', false)).toBe(true)
  })

  it('allows general response without tool call', () => {
    expect(containsUngroundedClaim('איטליה היא מדינה באירופה', false)).toBe(false)
    expect(containsUngroundedClaim('הנה בדיחה', false)).toBe(false)
  })

  it('allows empty/short response', () => {
    expect(containsUngroundedClaim('', false)).toBe(false)
    expect(containsUngroundedClaim('בסדר', false)).toBe(false)
  })
})
