/*
 * relationTermMatrix.test.ts — the relation BETWEEN two people is the KINSHIP TERM a Hebrew-speaking
 * family member would actually say, NOT a graph-path traversal artifact (owner, 3rd rejection).
 * ════════════════════════════════════════════════════════════════════════════
 * THE ORACLE FIX (see QA_MISSES.md, class ORACLE-FROM-IMPL). The previous tests asserted whatever the
 * resolver RETURNED, so a path answer passed even though a human would never say it ("נכד של החמות"
 * instead of "בן דוד של אשתו"). Here every EXPECTED value is authored from what a person WOULD SAY —
 * independent of the implementation. If the resolver drifts back to a path, these fail.
 *
 * Rule: (1) a single term; (2) a term via the SPOUSE ("בן דוד של אשתו"); (3) only if NO term exists, the
 * shortest path in one phrase, FLAGGED term-absent; never through Martita; never "בני משפחה".
 */
import { describe, it, expect } from 'vitest'
import { relationBetween } from './kinship'
import { loadPeople, resolvePersonId } from './peopleModel'

const P = loadPeople()
const rel = (a: string, b: string) => relationBetween(resolvePersonId(a)!, resolvePersonId(b)!, P)

// EXPECTED = what a Hebrew-speaking family member says. Authored by hand, NOT read from the resolver.
const EXPECTED: Array<[string, string, string]> = [
  // ── the owner's acceptance cases ──
  ['עדי', 'גלעד', 'עדי בן דוד של אשתו של גלעד'],   // cousin of his wife — one term via the SPOUSE
  ['רפי', 'לאו', 'רפי גיס של לאו'],                 // brother-in-law — ONE term
  ['ירדן', 'עדי', 'ירדן אשת בן הדוד של עדי'],       // the wife of his cousin
  ['יעל', 'לאו', 'יעל גיסה של לאו'],                // the actual term, never "בני משפחה"
  // ── direct blood terms ──
  ['עדי', 'נועם', 'עדי אח של נועם'],
  ['לאו', 'מור', 'לאו אח של מור'],
  ['עדי', 'מור', 'עדי אחיין של מור'],
  ['אופיר', 'עדי', 'אופיר בת דודה של עדי'],
  ['בובי', 'לאו', 'בובי דוד של לאו'],
  ['חורחה', 'לאו', 'חורחה בן דוד של לאו'],
  // ── direct in-law terms ──
  ['גלעד', 'מור', 'גלעד חתן של מור'],               // son-in-law
  ['ירדן', 'מור', 'ירדן כלה של מור'],               // daughter-in-law
  // ── generational distance via a PARENT (the nephew/niece line — the Martin contradiction) ──
  ['מרטין', 'מרטיטה', 'מרטין בן האחיין של מרטיטה'],   // great-nephew = son of her nephew (NOT "great-grandson of her mother")
  ['פאבי', 'מרטיטה', 'פאבי בן האחיין של מרטיטה'],
  ['מרטיטה', 'מרטין', 'מרטיטה דודה של האבא של מרטין'],
  // ── term via a spouse (both directions) ──
  ['ירדן', 'לאו', 'ירדן אשת האחיין של לאו'],
  ['ירדן', 'גלעד', 'ירדן גיסה של אשתו של גלעד'],
  ['גלעד', 'עדי', 'גלעד בעל בת הדודה של עדי'],
]

describe('relationBetween — the human kinship term, not a path (authored expectations)', () => {
  for (const [a, b, want] of EXPECTED) {
    it(`${a} ↔ ${b} → "${want}"`, () => {
      const r = rel(a, b)
      expect(r).not.toBeNull()
      expect(r!.text).toBe(want)
      expect(r!.termAbsent).toBe(false)
    })
  }

  it('term-absent pairs (if any) are FLAGGED, ≤2 hops, and never "בני משפחה"', () => {
    // No hardcoded pair — scan the matrix. Every term-ABSENT result must be an auditable, ≤2-hop path,
    // never the generic bucket. (Most 2-hop pairs now derive a real term via parent/spouse expansion.)
    let sawAbsent = 0
    for (const x of P) for (const y of P) {
      if (x.id === y.id || x.deceased || y.deceased) continue
      const r = relationBetween(x.id, y.id, P)
      if (!r || !r.termAbsent) continue
      sawAbsent++
      expect((r.text.match(/ של /g) ?? []).length, r.text).toBeLessThanOrEqual(2)
      expect(r.text).not.toMatch(/בני משפחה/)
    }
    expect(sawAbsent).toBeGreaterThan(0) // the term-absent path IS exercised somewhere
  }, 30_000)
})

describe('universal invariants over the FULL ordered pair matrix', () => {
  const people = P.filter((p) => !p.deceased && p.id !== 'martita')
  const MARTITA = new Set(['מרטיטה', 'מרתיטה', 'מרטה', 'מרתה'])
  it('never "בני משפחה"; never routed through Martita for a pair that is not about her', () => {
    let checked = 0
    for (const x of people) for (const y of people) {
      if (x.id === y.id) continue
      const r = relationBetween(x.id, y.id, P)
      if (!r) continue
      checked++
      expect(r.text, `${x.hebrewName}↔${y.hebrewName}`).not.toMatch(/בני משפחה/)
      // Martita is not in the answer unless she is one of the two asked about.
      for (const m of MARTITA) expect(r.text.includes(m), `${x.hebrewName}↔${y.hebrewName} routed through ${m}`).toBe(false)
      // NEVER a chain of 3+ hops (a traversal artifact) — at most two "של" (owner: max two hops).
      expect((r.text.match(/ של /g) ?? []).length, `${x.hebrewName}↔${y.hebrewName} is a chain: ${r.text}`).toBeLessThanOrEqual(2)
    }
    expect(checked).toBeGreaterThan(200)
  }, 30_000) // the full matrix + term-absent path BFS is O(n^2); generous ceiling
})
