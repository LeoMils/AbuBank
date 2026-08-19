/*
 * Regression: the rich Hebrew family answer must not repeat the partner when the
 * location notes already mention them. Mor's notes are "וילה עם יעל" and her
 * partner is "יעל" — the answer previously rendered "...עם יעל עם יעל".
 */
import { describe, it, expect } from 'vitest'
import { shapeFamilyAnswer } from './responseShaper'
import { loadFamilyData } from '../../services/familyLoader'

describe('rich family answer — no doubled partner', () => {
  const mor = loadFamilyData().find((m) => m.canonicalName === 'Mor')!

  it('does not repeat "עם יעל" when location notes already include the partner', () => {
    const rich = shapeFamilyAnswer(mor, true)
    expect(rich).toContain('יעל')
    // The partner name must appear at most as many times as the data warrants —
    // never the duplicated "עם יעל עם יעל".
    expect(rich.includes('עם יעל עם יעל')).toBe(false)
    const occurrences = (rich.match(/עם יעל/g) ?? []).length
    expect(occurrences).toBeLessThanOrEqual(1)
  })

  it('still mentions her children and her POV ("שלך", never "שלי")', () => {
    const rich = shapeFamilyAnswer(mor, true)
    expect(rich).toContain('הבת שלך')
    expect(/\bשלי\b/.test(rich)).toBe(false)
  })
})
