/*
 * Regression: the family-relation LABEL table is gender-correct at the OUTPUT path.
 * ═══════════════════════════════════════════════════════════════════════════════
 * Mutation-harness survivor (docs/warroom/LOG.md, Run 1): swapping the feminine and
 * masculine grandchild terms in `familyRelationEngine.ts`
 *   grandchild: ['נכדה', 'נכד']  →  ['נכד', 'נכדה']
 * passed the ENTIRE 12662-test suite. `ofirGenderRegression` guards the gender DATA
 * (graph field) and the Martita→grandchild direction (סבתא), but NOTHING asserted the
 * grandchild-direction LABEL that `labelFor()` emits to Martita. A female granddaughter
 * would have been called "נכד" (grandson) in a real answer, unnoticed.
 *
 * This locks the OUTPUT: for every gendered kinship the real `relationOf()` sentence
 * must carry the term matching the person's gender. Derived from the live graph — no
 * hardcoded names — so it generalizes to every current and future grandchild.
 */
import { describe, it, expect } from 'vitest'
import { relationOf, type RelationKind } from './familyRelationEngine'
import { loadGraph } from './familyGraph'

const HUB = 'מרטיטה' // Martita — the family hub every relation is measured against.
const people = loadGraph()

/** Everyone whose relation TO Martita is `kind`, with their gender. */
function withKind(kind: RelationKind) {
  return people
    .map((n) => ({ he: n.hebrew, gender: n.gender, r: relationOf(n.hebrew, HUB, 'he') }))
    .filter((x) => x.r.kind === kind)
}

describe('family LABEL table — output gender correctness (mutation-survivor guard)', () => {
  it('grandchildren exist of BOTH genders (guards against a vacuous pass)', () => {
    const gc = withKind('grandchild')
    expect(gc.some((x) => x.gender === 'female')).toBe(true)
    expect(gc.some((x) => x.gender === 'male')).toBe(true)
  })

  it('every FEMALE grandchild is called נכדה (never the masculine נכד) in the real sentence', () => {
    for (const x of withKind('grandchild').filter((p) => p.gender === 'female')) {
      expect(x.r.sentence, `${x.he}: ${x.r.sentence}`).toContain('נכדה')
    }
  })

  it('every MALE grandchild is called נכד and never נכדה', () => {
    // NB: JS \b is ASCII-only and forms no boundary against Hebrew letters — use
    // substring checks: masculine "נכד" is present, feminine "נכדה" is not.
    for (const x of withKind('grandchild').filter((p) => p.gender === 'male')) {
      expect(x.r.sentence, `${x.he}: ${x.r.sentence}`).toContain('נכד')
      expect(x.r.sentence, `${x.he}: ${x.r.sentence}`).not.toContain('נכדה')
    }
  })

  it('female child is בת and male child is בן (same labelFor path, broader guard)', () => {
    const kids = withKind('child')
    for (const x of kids.filter((p) => p.gender === 'female')) expect(x.r.sentence).toContain('בת')
    for (const x of kids.filter((p) => p.gender === 'male')) expect(x.r.sentence).toContain('בן')
  })
})
