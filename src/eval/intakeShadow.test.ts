/*
 * SHADOW VALIDATION — legacy pattern intake vs the morphology seam.
 * Proves (obligations #2, #6, #13) that the seam is a strict SUPERSET of the retired
 * legacy REL intake over a broad corpus: zero regression, zero disagreement, real
 * recovery — which is the evidence that justifies retiring the legacy path.
 */
import { describe, it, expect } from 'vitest'
import { shadowCompare, asIntakeFn } from './intakeShadow'
import { answerFamilyRelation } from '../screens/AbuAI/familyReasoning'
import { legacyAnswerFamilyRelation } from '../screens/AbuAI/legacyFamilyIntake'
import { relationTypesWithForms, surfaceFormsOf } from '../truth/relationMorphology'
import { garbleVariants } from '../truth/garbleMutator'

const SUBJECTS = ['מרטיטה', 'מור', 'אופיר', 'רפי', 'לאו', 'ארי', 'גלעד']

function buildCorpus(): string[] {
  const out = new Set<string>()
  // who-is across every inflection × member (+ light garble)
  for (const type of relationTypesWithForms()) {
    for (const form of surfaceFormsOf(type)) {
      for (const s of SUBJECTS) {
        out.add(`מי ${form} של ${s}`)
        out.add(`${form} של ${s}`)
      }
    }
  }
  // shapes the LEGACY intake specifically handled (must not regress)
  for (const s of SUBJECTS) {
    out.add(`ממי ${s} גרושה`); out.add(`${s} גרושה ממי`)
    out.add(`רפי הגרוש של מי`); out.add(`מי הגרוש של ${s}`)
    out.add(`מי זאת הסבתא של ${s}`); out.add(`מי בעלה של ${s}`); out.add(`מי אשתו של ${s}`)
  }
  // garble a sample so recovery (a legacy miss the seam catches) shows up
  for (const s of ['מור', 'אופיר']) for (const t of ['החתן', 'הגרוש', 'בת הזוג'])
    for (const g of garbleVariants(`מי ${t} של ${s}`, 3)) out.add(g)
  return [...out]
}

describe('SHADOW · seam ⊇ legacy family intake', () => {
  const report = shadowCompare(
    asIntakeFn(legacyAnswerFamilyRelation),
    asIntakeFn(answerFamilyRelation),
    buildCorpus(),
  )

  it('ZERO regression — the seam never loses a person the legacy intake resolved', () => {
    expect(report.regressed, JSON.stringify(report.divergences.filter((d) => d.kind === 'regressed').slice(0, 8))).toBe(0)
  })
  it('ZERO disagreement — where both resolve, they resolve to the SAME people', () => {
    expect(report.disagree, JSON.stringify(report.divergences.filter((d) => d.kind === 'disagree').slice(0, 8))).toBe(0)
  })
  it('REAL recovery — the seam resolves cases the legacy intake punted (in-laws / possessive / garble)', () => {
    expect(report.recovered).toBeGreaterThan(20)
  })
  it('KPIs are published (obligation 7)', () => {
    expect(report.total).toBeGreaterThan(300)
    expect(report.agreementRate + report.recoveryRate).toBeGreaterThan(0.9)
    // eslint-disable-next-line no-console
    console.log(`[SHADOW KPI] total=${report.total} agree=${report.agree} recovered=${report.recovered} regressed=${report.regressed} disagree=${report.disagree} agreementRate=${report.agreementRate.toFixed(3)} recoveryRate=${report.recoveryRate.toFixed(3)}`)
  })

  it('retirement criterion MET: regressed=0 AND disagree=0 → legacy intake is safely retired', () => {
    expect(report.regressed === 0 && report.disagree === 0).toBe(true)
  })
})
