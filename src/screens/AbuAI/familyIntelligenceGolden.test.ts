/*
 * AbuAI B2.5 — Golden family intelligence test.
 *
 * Hand-written test cases that pin the exact semantic output for the
 * relationships Leo and Martita care about. Each case asserts both the
 * structured RelationResult type and the must-contain / must-NOT-contain
 * substrings of the natural-language sentence in HE / ES / EN.
 *
 * These tests are the floor of "complete family intelligence". They are
 * intentionally tighter than realUserDiagnostic.test.ts.
 */

import { describe, it, expect } from 'vitest'
import { resolveRelationship, type RelationType } from './familyGraph'
import { tryGroundedAnswer } from './service'

interface Golden {
  a: string
  b: string
  type: RelationType
  he?: { contains: string[]; missing?: string[] }
  es?: { contains: string[]; missing?: string[] }
  en?: { contains: string[]; missing?: string[] }
}

const GOLDEN: Golden[] = [
  // 1) Rafi ↔ Leo — former brothers-in-law (the headline case).
  {
    a: 'רפי', b: 'לאו', type: 'former_brother_in_law',
    he: { contains: ['גיסים לשעבר', 'רפי', 'לאו', 'מור', 'אחות'], missing: ['קשור', 'Raphi'] },
    es: { contains: ['cuñados', 'casado', 'Mor', 'hermana'], missing: ['conectad', 'Raphi'] },
    en: { contains: ['brothers-in-law', 'married', 'Mor', 'sister'], missing: ['connected to', 'Raphi'] },
  },

  // 2) Gilad ↔ Eylon — brothers-in-law (Ofir is Eylon's brother).
  {
    a: 'גלעד', b: 'איילון', type: 'brother_in_law',
    he: { contains: ['גיסים', 'אופיר', 'אח'], missing: ['קשור', 'גיסים לשעבר'] },
    es: { contains: ['cuñados', 'Ofir', 'hermano'], missing: ['conectad'] },
    en: { contains: ['brothers-in-law', 'Ofir', 'brother'], missing: ['connected to'] },
  },

  // 3) Gilad ↔ Martita — grandchild-in-law (Gilad is married to Ofir,
  //    Martita's grandson). 3-hop case that B2.4.1 could not answer.
  {
    a: 'גלעד', b: 'מרטיטה', type: 'grandchild_in_law',
    he: { contains: ['גלעד', 'אופיר', 'מרטיטה', 'נכד'], missing: ['קשור', 'לא מצאתי'] },
    es: { contains: ['Gilad', 'Ofir', 'Martita', 'nieto'], missing: ['conectad', 'No encontré'] },
    en: { contains: ['Gilad', 'Ofir', 'Martita', 'grandson'], missing: ['connected to', 'did not find'] },
  },

  // 4) Mor ↔ Rafi — ex-spouses.
  {
    a: 'מור', b: 'רפי', type: 'ex_spouse',
    he: { contains: ['גרושים'], missing: ['קשור', 'גיסים'] },
    es: { contains: ['divorciados'] },
    en: { contains: ['divorced'] },
  },

  // 5) Mor ↔ Leo — siblings (both Martita's children).
  {
    a: 'מור', b: 'לאו', type: 'sibling',
    he: { contains: ['אחים', 'מרטיטה'], missing: ['קשור'] },
    es: { contains: ['hermanos', 'Martita'] },
    en: { contains: ['siblings', 'Martita'] },
  },

  // 6) Ofir ↔ Gilad — spouses (per family_data).
  {
    a: 'אופיר', b: 'גלעד', type: 'spouse',
    he: { contains: ['נשואים'] },
    es: { contains: ['casados'] },
    en: { contains: ['married'] },
  },

  // 7) Gilad ↔ Anabel — parent-child (Gilad is Anabel's father).
  {
    a: 'גלעד', b: 'אנאבל', type: 'parent',
    he: { contains: ['אבא של אנאבל'] },
    es: { contains: ['padre', 'Anabel'] },
    en: { contains: ['father', 'Anabel'] },
  },

  // 8) Martita ↔ Leo — parent.
  {
    a: 'מרטיטה', b: 'לאו', type: 'parent',
    he: { contains: ['האמא של לאו'] },
    es: { contains: ['madre', 'Leo'] },
    en: { contains: ['mother', 'Leo'] },
  },

  // 9) Martita ↔ Adi — grandparent (1-hop ancestor through Leo).
  {
    a: 'מרטיטה', b: 'עדי', type: 'grandparent',
    he: { contains: ['הסבתא של עדי', 'לאו'] },
    es: { contains: ['abuela', 'Adi', 'Leo'] },
    en: { contains: ['grandmother', 'Adi', 'Leo'] },
  },

  // 10) Martita ↔ Anabel — great-grandparent.
  {
    a: 'מרטיטה', b: 'אנאבל', type: 'great_grandparent',
    he: { contains: ['סבתא רבא', 'אנאבל'] },
    es: { contains: ['bisabuela', 'Anabel'] },
    en: { contains: ['great-grandmother', 'Anabel'] },
  },

  // 11) Leo ↔ Ofir — uncle / nephew (Leo is Mor's brother; Ofir is Mor's son).
  {
    a: 'לאו', b: 'אופיר', type: 'uncle_aunt',
    he: { contains: ['הדוד של אופיר', 'מור'] },
    es: { contains: ['tío', 'Ofir', 'Mor'] },
    en: { contains: ['uncle', 'Ofir', 'Mor'] },
  },

  // 12) Adi ↔ Ofir — cousins (both grandchildren of Martita).
  {
    a: 'עדי', b: 'אופיר', type: 'cousin',
    he: { contains: ['בני דודים', 'מרטיטה'] },
    es: { contains: ['primos', 'Martita'] },
    en: { contains: ['cousins', 'Martita'] },
  },

  // 13) Mor ↔ Yarden — daughter-in-law style (Yarden is married to Eili,
  //     Mor's son). Verifies Hebrew gender agreement on the marriage verb.
  {
    a: 'מור', b: 'ירדן', type: 'daughter_in_law',
    he: { contains: ['עילי', 'נשוי לירדן'], missing: ['נשואה לירדן'] },
    es: { contains: ['Yarden', 'Eili'] },
    en: { contains: ['Yarden', 'Eili'] },
  },

  // 14) Eylon ↔ Mor — parent-child (Mor is Eylon's mother).
  {
    a: 'אילון', b: 'מור', type: 'parent',
    he: { contains: ['האמא של איילון'] },
    es: { contains: ['madre'] },
    en: { contains: ['mother'] },
  },
]

describe('B2.5 — golden family intelligence (handwritten)', () => {
  for (const g of GOLDEN) {
    it(`${g.a} ↔ ${g.b} → ${g.type}`, () => {
      // Hebrew
      const rHe = resolveRelationship(g.a, g.b, 'he')
      expect(rHe.type, `HE type for ${g.a}↔${g.b}`).toBe(g.type)
      expect(rHe.confidence).toBe('derived_from_explicit_data')
      if (g.he) {
        for (const sub of g.he.contains) {
          expect(rHe.he, `${g.a}↔${g.b} HE expected "${sub}"`).toContain(sub)
        }
        for (const sub of g.he.missing ?? []) {
          expect(rHe.he.includes(sub), `${g.a}↔${g.b} HE must NOT contain "${sub}"`).toBe(false)
        }
      }
      // Spanish
      const rEs = resolveRelationship(g.a, g.b, 'es')
      expect(rEs.type, `ES type for ${g.a}↔${g.b}`).toBe(g.type)
      if (g.es) {
        for (const sub of g.es.contains) {
          expect(rEs.es, `${g.a}↔${g.b} ES expected "${sub}"`).toContain(sub)
        }
        for (const sub of g.es.missing ?? []) {
          expect(rEs.es.includes(sub), `${g.a}↔${g.b} ES must NOT contain "${sub}"`).toBe(false)
        }
      }
      // English
      const rEn = resolveRelationship(g.a, g.b, 'en')
      expect(rEn.type, `EN type for ${g.a}↔${g.b}`).toBe(g.type)
      if (g.en) {
        for (const sub of g.en.contains) {
          expect(rEn.en, `${g.a}↔${g.b} EN expected "${sub}"`).toContain(sub)
        }
        for (const sub of g.en.missing ?? []) {
          expect(rEn.en.includes(sub), `${g.a}↔${g.b} EN must NOT contain "${sub}"`).toBe(false)
        }
      }
    })
  }

  // Spot-check the runtime path: tryGroundedAnswer must produce the
  // same HE string as the resolver for each Hebrew router phrasing.
  it('runtime tryGroundedAnswer produces the same HE answer for Rafi↔Leo via "מה הקשר בין"', () => {
    const ans = tryGroundedAnswer('מה הקשר בין רפי ללאו?') ?? ''
    expect(ans).toContain('גיסים לשעבר')
    expect(ans).toContain('אחות')
  })

  it('runtime accepts "מה הקשר בין גלעד למרטיטה?" — answers grandchild-in-law', () => {
    const ans = tryGroundedAnswer('מה הקשר בין גלעד למרטיטה?') ?? ''
    expect(ans).toContain('גלעד')
    expect(ans).toContain('אופיר')
    expect(ans).toContain('מרטיטה')
    expect(/נכד|הנכד/.test(ans)).toBe(true)
    expect(ans.includes('לא מצאתי')).toBe(false)
  })
})
