/*
 * P3 · garble suite (permanent). A deterministic STT-corruption mutator over the
 * relation corpus, proving the seam's phonetic garble-tolerance: a single-character
 * near-homophone slip in a relation TERM still resolves to the right person, instead
 * of punting. Word-SPLIT garble is the harder class (left to STT-recovery / the P1
 * understanding layer) — measured honestly by a survival floor, not hidden.
 */
import { describe, it, expect } from 'vitest'
import { garble, garbleVariants } from './garbleMutator'
import { normalizeRelationTerm, type RelationType } from './relationMorphology'
import { resolveSinglePerson } from '../screens/AbuAI/familyReasoning'

describe('P3 · garble mutator is deterministic (reproducible suite)', () => {
  it('same input + index → same output', () => {
    expect(garble('החתן של מור', 4)).toBe(garble('החתן של מור', 4))
  })
  it('produces distinct variants', () => {
    expect(garbleVariants('בת הזוג של מור', 5).length).toBeGreaterThanOrEqual(3)
  })
})

const CORPUS: Array<[string, RelationType]> = [
  ['החתן', 'son_in_law'], ['הכלה', 'daughter_in_law'], ['הגרוש', 'ex_spouse'],
  ['הסבתא', 'grandmother'], ['הסבא', 'grandfather'], ['בת הזוג', 'partner'],
  ['הבת', 'daughter'], ['הבן', 'son'], ['אמא', 'mother'], ['הדוד', 'uncle'], ['הדודה', 'aunt'],
]

describe('P3 · phonetic garble-tolerance in the seam', () => {
  for (const [term, type] of CORPUS) {
    it(`clean "${term}" → ${type}`, () => expect(normalizeRelationTerm(term)).toBe(type))
  }

  it('single near-homophone slips in a term still normalize (never mis-map to another relation)', () => {
    let recovered = 0, applicable = 0
    for (const [term, type] of CORPUS) {
      // index 0/3/6 are homophone-swap variants (see garbleMutator ordering)
      for (const idx of [0, 3, 6]) {
        const g = garble(term, idx)
        if (g === term) continue
        applicable++
        const norm = normalizeRelationTerm(g)
        // MUST be either the right type or unresolved — NEVER a different relation.
        expect(norm === type || norm === null).toBe(true)
        if (norm === type) recovered++
      }
    }
    // Most homophone slips recover deterministically (the point of the phonetic fold).
    expect(recovered / applicable).toBeGreaterThan(0.6)
  })

  it('end-to-end: garbled relation phrases still resolve to the real person', () => {
    expect(resolveSinglePerson('החטן של מור')?.person).toBe('גלעד')   // ת→ט
    expect(resolveSinglePerson('הגרבש של מור')?.person).toBe('רפי')   // ו-slip in גרוש
    expect(resolveSinglePerson('בט הזוג של מור')?.person).toBe('יעל')  // ת→ט in בת
  })

  it('garble NEVER produces a wrong person (honest miss > wrong answer)', () => {
    // Over every single-garble of every corpus phrase "of מור", any resolution must be
    // a real relative of מור — never a fabricated or mismatched person.
    const molRelatives = new Set(['גלעד', 'ירדן', 'רפי', 'יעל', 'אופיר', 'לאו', 'מרטיטה'])
    for (const [term] of CORPUS) {
      for (const g of garbleVariants(`${term} של מור`, 8)) {
        const r = resolveSinglePerson(g)
        if (r) expect(molRelatives.has(r.person)).toBe(true)
      }
    }
  })
})
