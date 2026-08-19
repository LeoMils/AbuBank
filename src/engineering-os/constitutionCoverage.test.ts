/*
 * CONSTITUTION-COVERAGE adversarial suite (§5). CT1–CT5 spec-derived.
 * Expected coverage comes from the PROBES, not the constitution under test.
 */
import { describe, it, expect } from 'vitest'
import { evaluateConstitutionCoverage, defaultCalibrationProbes, type ConstitutionCoverageInput, type CalibrationProbe } from './constitutionCoverage'
import { defaultConstitution } from './obligationCompleteness'

const INVARIANTS = defaultConstitution().invariants.map((i) => i.id)
const codes = (i: ConstitutionCoverageInput) => evaluateConstitutionCoverage(i).blockers.map((b) => b.code)

describe('constitution coverage — green baseline', () => {
  it('the real 15-invariant constitution governs every default calibration probe', () => {
    const r = evaluateConstitutionCoverage({ invariantIds: INVARIANTS, probes: defaultCalibrationProbes() })
    expect(r.blockers, JSON.stringify(r.blockers)).toEqual([])
    expect(r.distribution.GAP).toBe(0)
  })
})

describe('constitution coverage adversarial CT1–CT5', () => {
  const withProbe = (extra: CalibrationProbe): ConstitutionCoverageInput =>
    ({ invariantIds: INVARIANTS, probes: [...defaultCalibrationProbes(), extra] })

  it('CT1 · release exit requirement with no governing invariant → CONSTITUTIONAL_COVERAGE_GAP', () => {
    expect(codes(withProbe({ id: 'exit-new', source: 'RELEASE_EXIT_CONTRACT', requirement: 'new release requirement', releaseCritical: true }))).toContain('CONSTITUTIONAL_COVERAGE_GAP')
  })
  it('CT2 · historical escape class with no governing invariant → CONSTITUTIONAL_COVERAGE_GAP', () => {
    expect(codes(withProbe({ id: 'esc-new', source: 'HISTORICAL_ESCAPE', requirement: 'a never-before-seen escape class', releaseCritical: true }))).toContain('CONSTITUTIONAL_COVERAGE_GAP')
  })
  it('CT3 · removing the invariant that governs an obligation surfaces the gap', () => {
    const without = INVARIANTS.filter((i) => i !== 'privacy-security')
    expect(codes({ invariantIds: without, probes: defaultCalibrationProbes() })).toContain('CONSTITUTIONAL_COVERAGE_GAP')
  })
  it('CT4 · irrelevant non-release-critical metadata → NO false constitutional requirement', () => {
    expect(evaluateConstitutionCoverage(withProbe({ id: 'trivia', source: 'HISTORICAL_ESCAPE', requirement: 'a cosmetic log wording preference', releaseCritical: false })).blockers).toEqual([])
  })
  it('CT5 · a new capability risk family with no governing invariant → CONSTITUTIONAL_COVERAGE_GAP', () => {
    expect(codes(withProbe({ id: 'risk-new', source: 'CAPABILITY_RISK_FAMILY', requirement: 'a newly discovered high-risk capability family', releaseCritical: true }))).toContain('CONSTITUTIONAL_COVERAGE_GAP')
  })
})
