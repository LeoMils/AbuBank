/*
 * GENERATIVE morphology suite (intake-rebuild P2). Auto-generated from the
 * morphology table × the real family graph, so coverage grows with the table,
 * not with hand-written cases. Two invariants:
 *
 *   1. NORMALIZATION — every surface form (bare + definite ה) of a relation term
 *      normalizes to its canonical type, both standalone and inside "<term> של X".
 *   2. RESOLUTION INVARIANCE — every inflection of a term resolves to the SAME
 *      real family member (an inflected phrase never punts to the LLM when a bare
 *      one would answer). Includes in-law terms (חתן/כלה) the old pattern intake
 *      could not resolve at all — the RED anchor for this rebuild.
 *
 * Truths were verified against knowledge/family_data.json via the live graph.
 */
import { describe, it, expect } from 'vitest'
import {
  normalizeRelationTerm, parseRelationQuery,
  relationTypesWithForms, surfaceFormsOf, type RelationType,
} from './relationMorphology'
import { answerFamilyRelation } from '../screens/AbuAI/familyReasoning'

describe('P2 · normalization seam covers the full inflection space', () => {
  for (const type of relationTypesWithForms()) {
    for (const form of surfaceFormsOf(type)) {
      it(`"${form}" (and "ה${form}") → ${type}`, () => {
        expect(normalizeRelationTerm(form)).toBe(type)
        expect(normalizeRelationTerm('ה' + form)).toBe(type)
      })
      it(`"${form} של מור" parses as ${type} of מור`, () => {
        const q = parseRelationQuery(`${form} של מור`)
        expect(q).not.toBeNull()
        expect(q!.type).toBe(type)
        expect(q!.subject).toBe('מור')
        expect(q!.reverse).toBe(false)
      })
    }
  }

  it('a non-relation "X של Y" is not a relation query', () => {
    expect(parseRelationQuery('הכלב של מור')).toBeNull()   // dog, not kin
    expect(parseRelationQuery('הבית של מור')).toBeNull()   // house
  })
})

/*
 * Verified resolution truths — {canonical type, subject, a member that MUST appear}.
 * Each is exercised through EVERY inflected form of its type (morphology-invariance).
 */
const TRUTHS: Array<{ type: RelationType; subject: string; expect: string; note?: string }> = [
  { type: 'daughter',        subject: 'מרטיטה', expect: 'מור' },
  { type: 'son',             subject: 'מרטיטה', expect: 'לאו' },
  { type: 'mother',          subject: 'אופיר',  expect: 'מור' },
  { type: 'father',          subject: 'אופיר',  expect: 'רפי' },
  { type: 'sister',          subject: 'לאו',    expect: 'מור' },
  { type: 'brother',         subject: 'מור',    expect: 'לאו' },
  { type: 'grandmother',     subject: 'ארי',    expect: 'מור' },
  { type: 'grandchildren',   subject: 'מרטיטה', expect: 'אופיר' },
  { type: 'partner',         subject: 'מור',    expect: 'יעל' },
  { type: 'ex_spouse',       subject: 'מור',    expect: 'רפי' },
  { type: 'uncle',           subject: 'אופיר',  expect: 'לאו' },
  // NEW capability the pattern intake could not resolve (in-laws):
  { type: 'son_in_law',      subject: 'מור',    expect: 'גלעד', note: 'חתן = spouse of daughter Ofir' },
  { type: 'daughter_in_law', subject: 'מור',    expect: 'ירדן', note: 'כלה = spouse of a son' },
]

describe('P2 · resolution is invariant across every inflection', () => {
  for (const t of TRUTHS) {
    for (const form of surfaceFormsOf(t.type)) {
      for (const term of [form, 'ה' + form]) {
        it(`"${term} של ${t.subject}" → contains ${t.expect}${t.note ? ` (${t.note})` : ''}`, () => {
          const ans = answerFamilyRelation(`${term} של ${t.subject}`)
          expect(ans, `no answer for "${term} של ${t.subject}"`).not.toBeNull()
          expect(ans!.known, `"${term} של ${t.subject}" should be known`).toBe(true)
          expect(ans!.results).toContain(t.expect)
        })
      }
    }
  }
})

describe('P2 · in-law who-is (RED before the seam — pattern intake returned null)', () => {
  it('"מי החתן של מור" → גלעד', () => {
    const a = answerFamilyRelation('מי החתן של מור')
    expect(a?.known).toBe(true)
    expect(a?.relation).toBe('son_in_law')
    expect(a?.results).toContain('גלעד')
  })
  it('"מי הכלה של מור" → ירדן', () => {
    const a = answerFamilyRelation('מי הכלה של מור')
    expect(a?.known).toBe(true)
    expect(a?.relation).toBe('daughter_in_law')
    expect(a?.results).toContain('ירדן')
  })
  it('honest emptiness: a relation with no member is known=false, never invented', () => {
    // Ofir's aunt (female sibling of her parent Mor) does not exist in the graph.
    const a = answerFamilyRelation('מי הדודה של אופיר')
    expect(a).not.toBeNull()
    expect(a!.known).toBe(false)
    expect(a!.results).toEqual([])
  })
})

describe('P2 · ex-spouse directionality preserved through the seam', () => {
  it('reverse "רפי הגרוש של מי" → מור', () => {
    const a = answerFamilyRelation('רפי הגרוש של מי')
    expect(a?.results).toContain('מור')
  })
  it('from-whom "ממי מור גרושה" → רפי (legacy shape, still answered)', () => {
    const a = answerFamilyRelation('ממי מור גרושה')
    expect(a?.results).toContain('רפי')
  })
})
