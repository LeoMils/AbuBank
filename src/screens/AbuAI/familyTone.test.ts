import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { shapeFamilyAnswer, shapeFamilyAnswerES } from './responseShaper'
import { loadFamilyData } from '../../services/familyLoader'

const mor = () => loadFamilyData().find(m => m.hebrew === 'מור')!
const leo = () => loadFamilyData().find(m => m.hebrew === 'לאו')!

describe('family tone — terse vs rich differ (RC4), no database dumps', () => {
  it('"מי זאת מור?" is terse (role + anchor, no children list)', () => {
    const a = tryGroundedAnswer('מי זאת מור?')!
    expect(a).toContain('מור, הבת שלך')
    expect(a).not.toContain('אופיר, איילון, עילי ואדר') // no list dump in terse
  })

  it('"ספרי לי על מור" is richer AND different from the terse answer', () => {
    const terse = tryGroundedAnswer('מי זאת מור?')!
    const rich = tryGroundedAnswer('ספרי לי על מור')!
    expect(rich).not.toBe(terse)
    expect(rich.length).toBeGreaterThan(terse.length)
  })

  it('no answer uses the "X — relationshipHebrew" dump for a core relative', () => {
    const a = shapeFamilyAnswer(mor(), true)
    expect(a).not.toMatch(/מור — /) // core relative never rendered as a record
  })

  it('partner alias is named warmly, not via raw rel string', () => {
    expect(shapeFamilyAnswer(mor(), false)).toContain('יעל') // Mor's partner surfaced
  })
})

describe('family tone — Spanish is Rioplatense, Latin names, no colon-dump', () => {
  it('shapeFamilyAnswerES uses no "Hijos:" colon-label and Latin child names', () => {
    const a = shapeFamilyAnswerES(leo(), true)
    expect(a).not.toContain('Hijos:')      // colon-label dump removed
    expect(a).toContain('tu hijo')          // natural role
    // child names rendered Latin (Adi/Noam), not Hebrew script
    expect(a).toMatch(/Adi|Noam/)
    expect(a).not.toMatch(/עדי|נועם/)
  })

  it('terse Spanish is one warm line, no record format', () => {
    const a = shapeFamilyAnswerES(leo(), false)
    expect(a).toContain('Leo, tu hijo')
    expect(a).not.toContain('—') // no dash record
  })
})
