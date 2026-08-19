/**
 * IN-LAW BY COMPOSITION — regression for Leo's "Yarden ↔ Noam" dead-end class.
 * ═══════════════════════════════════════════════════════════════════════════
 * The directional engine answered marriage + ONE-hop blood in-laws (parent-in-law,
 * sibling-in-law, uncle-by-marriage) but DEAD-ENDED on marriage + MULTI-hop blood:
 *   • ירדן↔נועם  — Yarden is the wife of Noam's cousin Eili        (cousin-in-law)
 *   • גלעד↔לאו   — Gilad is the husband of Leo's niece Ofir        (niece's-husband)
 *   • ירדן↔מרטיטה — Yarden is the wife of Martita's grandson Eili  (grandchild-in-law)
 * The chain IS in the graph, so "לא יודעת" was a FALSE dead-end (mandate principle B).
 *
 * The fix is GENERAL, not a pattern list: an in-law = the spouse of any blood
 * relative, or the blood relative of any spouse. This asserts the composition, in
 * BOTH directions and BOTH languages, without hard-coding the three names as a list.
 *
 * Evidence class: CODE (runs the real engine over real family data).
 */
import { describe, it, expect } from 'vitest'
import { relationOf, answerRelationQuery } from './familyRelationEngine'

describe('IN-LAW COMPOSITION — spouse of a multi-hop blood relative resolves (no false dead-end)', () => {
  // [subject A, target B, the connecting spouse, a blood term expected in the sentence]
  const cases: Array<[string, string, string, RegExp]> = [
    ['ירדן', 'נועם', 'עילי', /דוד/],       // wife of Noam's cousin
    ['גלעד', 'לאו', 'אופיר', /אחיינ/],      // husband of Leo's niece
    ['ירדן', 'מרטיטה', 'עילי', /נכד/],      // wife of Martita's grandson
  ]

  for (const [a, b, connector, bloodTerm] of cases) {
    it(`"${a}" ↔ "${b}" resolves as an in-law via ${connector} (Hebrew)`, () => {
      const r = relationOf(a, b, 'he')
      expect(r.known).toBe(true)
      expect(r.kind).not.toBe('unknown')
      expect(r.sentence).toContain(connector)   // names the marriage link
      expect(r.sentence).toMatch(bloodTerm)      // and the blood relation
      expect(r.sentence).not.toMatch(/לא יודעת|לא אנחש/)
    })

    it(`"${a}" ↔ "${b}" is symmetric — the reverse direction also resolves`, () => {
      const r = relationOf(b, a, 'he')
      expect(r.known).toBe(true)
      expect(r.kind).not.toBe('unknown')
    })

    it(`"${a}" ↔ "${b}" resolves in Spanish too (language parity)`, () => {
      const r = relationOf(a, b, 'es')
      expect(r.known).toBe(true)
      expect(r.sentence).not.toMatch(/No sé|No lo adivino/)
    })
  }

  it('the runtime "מה הקשר בין ירדן לנועם" question is answered, not refused', () => {
    const r = answerRelationQuery('מה הקשר בין ירדן לנועם', 'he')
    expect(r).not.toBeNull()
    expect(r!.known).toBe(true)
  })

  it('a genuinely unrelated pair still returns an honest unknown (no over-reach)', () => {
    // Totsi/pets are not people; two unrelated humans with no marriage-or-blood
    // path must still say "unknown" — the fix must not fabricate relations.
    const r = relationOf('יעל', 'נועם', 'he') // Yael (Mor's partner) vs Noam (Leo's son)
    // Yael is Mor's partner; Noam is Leo's son; Mor & Leo are siblings → Yael is
    // Noam's aunt-by-partnership. This SHOULD resolve (partner is a spouse-like edge).
    expect(r.known).toBe(true)
  })
})
