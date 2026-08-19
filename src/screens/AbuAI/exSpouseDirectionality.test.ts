/**
 * Regression: family EX-SPOUSE directionality (release-gate for family correctness).
 *
 * Ground truth — knowledge/family_data.json:
 *   Mor (מור, female): ex_spouse = רפי, partner = יעל
 *   Raphi (רפי, male): ex_son_in_law, "הגרוש של מור"
 *
 * ex-spouse is a SYMMETRIC edge, so every phrasing reduces to "the named
 * person's ex-spouse" and Martita must get the right answer in BOTH directions:
 *   "מי הגרוש של מור"        → רפי   (who is Mor's ex-husband)
 *   "ממי מור גרושה"          → רפי   (from whom is Mor divorced)
 *   "רפי הוא הגרוש של מי"     → מור   (Rafi is whose ex-husband)
 *
 * Before the fix these all punted to the LLM (answerFamilyRelation returned null
 * because REL had no ex-spouse rule), while "מי בת הזוג של מור" → יעל worked.
 * This is a correctness bug, not style — hence a deterministic regression.
 */
import { describe, it, expect } from 'vitest'
import { tryGroundedAnswer } from './service'
import { answerFamilyRelation } from './familyReasoning'

describe('family ex-spouse directionality (deterministic, no LLM)', () => {
  it('forward: "מי הגרוש של מור" → רפי', () => {
    const answer = tryGroundedAnswer('מי הגרוש של מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('רפי')
  })

  it('forward (from-whom): "ממי מור גרושה" → רפי', () => {
    const answer = tryGroundedAnswer('ממי מור גרושה?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('רפי')
  })

  it('reverse: "רפי הוא הגרוש של מי" → מור', () => {
    const answer = tryGroundedAnswer('רפי הוא הגרוש של מי?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('מור')
  })

  it('reverse without copula: "רפי הגרוש של מי" → מור', () => {
    const answer = tryGroundedAnswer('רפי הגרוש של מי?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('מור')
  })

  it('resolver marks the relation known + returns the ex-spouse', () => {
    const fam = answerFamilyRelation('מי הגרוש של מור')
    expect(fam).not.toBeNull()
    expect(fam!.known).toBe(true)
    expect(fam!.relation).toBe('ex_spouse')
    expect(fam!.results).toContain('רפי')
  })

  it('never invents an ex-spouse for someone who has none (Leo)', () => {
    // Leo has no ex-spouse in the graph → not a known ex-spouse answer.
    const fam = answerFamilyRelation('מי הגרוש של לאו')
    // Either no ex-spouse rule matched with a result, or known=false — never a fabricated name.
    if (fam && fam.relation === 'ex_spouse') expect(fam.known).toBe(false)
  })

  it('does NOT regress the current-partner query: "מי בת הזוג של מור" → יעל', () => {
    const answer = tryGroundedAnswer('מי בת הזוג של מור?')
    expect(answer).not.toBeNull()
    expect(answer).toContain('יעל')
    expect(answer).not.toContain('רפי') // partner is Yael, not the ex-husband
  })
})
