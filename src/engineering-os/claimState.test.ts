/*
 * CLAIM-STATE adversarial suite (Stage 3C §10). CS1–CS11 spec-derived.
 * The point: NO optimistic normalization. Each non-proven condition keeps its OWN
 * terminal state and is NOT satisfied. Only a run+certified+fresh+present+passing
 * assertion (or proof-backed N/A) is satisfied.
 */
import { describe, it, expect } from 'vitest'
import { deriveClaimState, isClaimSatisfied, collapseViolations, ALL_CLAIM_STATES, type ClaimEvidenceInput, type ClaimState } from './claimState'

/** A fully-green evidence bundle — every gate satisfied. */
const green: ClaimEvidenceInput = {
  labExecuted: true, labCertified: true, expectedEvidencePresent: true,
  evidenceFresh: true, assertionRan: true, assertionPassed: true,
}

describe('claim-state — proven pass baseline', () => {
  it('a certified+fresh+present+passing assertion → CLAIM_PROVEN_PASS (satisfied)', () => {
    const r = deriveClaimState(green)
    expect(r.state).toBe('CLAIM_PROVEN_PASS')
    expect(r.satisfied).toBe(true)
  })
})

describe('claim-state adversarial CS1–CS11 — no optimistic collapse', () => {
  it('CS1 · assertion ran and FAILED → CLAIM_PROVEN_FAIL, not satisfied', () => {
    const r = deriveClaimState({ ...green, assertionPassed: false })
    expect(r.state).toBe('CLAIM_PROVEN_FAIL'); expect(r.satisfied).toBe(false)
  })
  it('CS2 · lab never executed → CLAIM_LAB_NOT_EXECUTED, not satisfied', () => {
    const r = deriveClaimState({ ...green, labExecuted: false })
    expect(r.state).toBe('CLAIM_LAB_NOT_EXECUTED'); expect(r.satisfied).toBe(false)
  })
  it('CS3 · lab uncertified → CLAIM_LAB_NOT_PROVEN, not satisfied', () => {
    const r = deriveClaimState({ ...green, labCertified: false })
    expect(r.state).toBe('CLAIM_LAB_NOT_PROVEN'); expect(r.satisfied).toBe(false)
  })
  it('CS4 · stale evidence → CLAIM_EVIDENCE_STALE, not satisfied', () => {
    const r = deriveClaimState({ ...green, evidenceFresh: false })
    expect(r.state).toBe('CLAIM_EVIDENCE_STALE'); expect(r.satisfied).toBe(false)
  })
  it('CS5 · expected evidence absent → CLAIM_EXPECTED_EVIDENCE_ABSENT, not satisfied', () => {
    const r = deriveClaimState({ ...green, expectedEvidencePresent: false })
    expect(r.state).toBe('CLAIM_EXPECTED_EVIDENCE_ABSENT'); expect(r.satisfied).toBe(false)
  })
  it('CS6 · evaluator crashed → CLAIM_EVALUATOR_CRASHED, not satisfied', () => {
    const r = deriveClaimState({ ...green, evaluatorCrashed: true })
    expect(r.state).toBe('CLAIM_EVALUATOR_CRASHED'); expect(r.satisfied).toBe(false)
  })
  it('CS7 · execution error → CLAIM_EXECUTION_ERROR, not satisfied', () => {
    const r = deriveClaimState({ ...green, executionError: true })
    expect(r.state).toBe('CLAIM_EXECUTION_ERROR'); expect(r.satisfied).toBe(false)
  })
  it('CS8 · no assertion ran → CLAIM_UNKNOWN, not satisfied', () => {
    const { assertionPassed: _drop, ...noAssert } = green
    const r = deriveClaimState({ ...noAssert, assertionRan: false })
    expect(r.state).toBe('CLAIM_UNKNOWN'); expect(r.satisfied).toBe(false)
  })
  it('CS9 · upstream blocked → CLAIM_BLOCKED, not satisfied', () => {
    const r = deriveClaimState({ ...green, blocked: true })
    expect(r.state).toBe('CLAIM_BLOCKED'); expect(r.satisfied).toBe(false)
  })
  it('CS10 · N/A WITH proof → CLAIM_NOT_APPLICABLE_WITH_PROOF, satisfied', () => {
    const r = deriveClaimState({ ...green, notApplicable: true, naProof: 'no online retrieval in this candidate' })
    expect(r.state).toBe('CLAIM_NOT_APPLICABLE_WITH_PROOF'); expect(r.satisfied).toBe(true)
  })
  it('CS11 · N/A WITHOUT proof → CLAIM_UNKNOWN (never a free pass), not satisfied', () => {
    const r = deriveClaimState({ ...green, notApplicable: true })
    expect(r.state).toBe('CLAIM_UNKNOWN'); expect(r.satisfied).toBe(false)
  })
})

describe('claim-state — precedence reports the EARLIEST defect (no fall-through to PASS)', () => {
  it('a broken pipeline with a passing assertion flag still reports the earlier defect', () => {
    // assertionPassed:true but lab not executed → must NOT be PASS.
    const r = deriveClaimState({ ...green, labExecuted: false, assertionPassed: true })
    expect(r.state).toBe('CLAIM_LAB_NOT_EXECUTED'); expect(r.satisfied).toBe(false)
  })
  it('blocked beats a stale/absent mix (upstream blocker wins)', () => {
    const r = deriveClaimState({ ...green, blocked: true, evidenceFresh: false, expectedEvidencePresent: false })
    expect(r.state).toBe('CLAIM_BLOCKED')
  })
})

describe('claim-state — anti-collapse invariant', () => {
  it('exactly two of the eleven states count as satisfied', () => {
    const satisfied = ALL_CLAIM_STATES.filter(isClaimSatisfied)
    expect(satisfied.sort()).toEqual(['CLAIM_NOT_APPLICABLE_WITH_PROOF', 'CLAIM_PROVEN_PASS'])
  })
  it('collapseViolations catches an optimistic predicate that would count FAIL/STALE as met', () => {
    const optimistic = (s: ClaimState) => s !== 'CLAIM_PROVEN_FAIL' // wrongly treats everything-but-fail as ok
    const violations = collapseViolations(optimistic)
    expect(violations.length).toBeGreaterThan(0)
    expect(violations).toContain('CLAIM_LAB_NOT_EXECUTED')
  })
  it('the honest predicate (isClaimSatisfied) has zero collapse violations', () => {
    expect(collapseViolations(isClaimSatisfied)).toEqual([])
  })
})
