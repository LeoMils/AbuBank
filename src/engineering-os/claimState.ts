/*
 * NON-COLLAPSIBLE CLAIM-STATE MODEL (o-claimstate).  (Stage 3C §10)
 * ════════════════════════════════════════════════════════════════════════════════
 * The oldest failure in this repo: a claim that was never really tested being reported
 * as green. "Gate green" collapsed a dozen distinct non-proven conditions — lab never
 * ran, evidence stale, evaluator crashed, applicability unknown — into a single
 * optimistic PASS. This model makes that collapse IMPOSSIBLE: every non-proven condition
 * has its OWN explicit, terminal state, and ONLY a genuinely executed+fresh+passing
 * assertion (or a proof-backed N/A) is treated as satisfied.
 *
 * No optimistic normalization. The derivation reports the EARLIEST real defect in the
 * evidence pipeline, never falling through to PASS. isClaimSatisfied() admits exactly
 * two states — PROVEN_PASS and NOT_APPLICABLE_WITH_PROOF — everything else is unmet.
 */

export type ClaimState =
  | 'CLAIM_PROVEN_PASS'
  | 'CLAIM_PROVEN_FAIL'
  | 'CLAIM_LAB_NOT_EXECUTED'
  | 'CLAIM_LAB_NOT_PROVEN'
  | 'CLAIM_EVIDENCE_STALE'
  | 'CLAIM_EXPECTED_EVIDENCE_ABSENT'
  | 'CLAIM_EVALUATOR_CRASHED'
  | 'CLAIM_EXECUTION_ERROR'
  | 'CLAIM_UNKNOWN'
  | 'CLAIM_BLOCKED'
  | 'CLAIM_NOT_APPLICABLE_WITH_PROOF'

export const ALL_CLAIM_STATES: readonly ClaimState[] = [
  'CLAIM_PROVEN_PASS', 'CLAIM_PROVEN_FAIL', 'CLAIM_LAB_NOT_EXECUTED', 'CLAIM_LAB_NOT_PROVEN',
  'CLAIM_EVIDENCE_STALE', 'CLAIM_EXPECTED_EVIDENCE_ABSENT', 'CLAIM_EVALUATOR_CRASHED',
  'CLAIM_EXECUTION_ERROR', 'CLAIM_UNKNOWN', 'CLAIM_BLOCKED', 'CLAIM_NOT_APPLICABLE_WITH_PROOF',
]

export interface ClaimEvidenceInput {
  /** An upstream blocker prevents this claim from being evaluated at all. */
  blocked?: boolean
  /** The claim is genuinely not applicable to this candidate/channel. */
  notApplicable?: boolean
  /** REQUIRED when notApplicable: the machine-recorded proof of non-applicability. */
  naProof?: string
  /** The evaluation threw / errored before producing a verdict. */
  executionError?: boolean
  /** The evaluator/oracle itself crashed (distinct from a normal FAIL). */
  evaluatorCrashed?: boolean
  /** Did the lab/evaluator actually run for this claim? */
  labExecuted: boolean
  /** Is the lab certified to discriminate for this claim's scope (o-labcert)? */
  labCertified: boolean
  /** Was the expected evidence artifact actually produced/present? */
  expectedEvidencePresent: boolean
  /** Is the evidence fresh — bound to the current candidate (computed, not asserted)? */
  evidenceFresh: boolean
  /** Did a concrete assertion actually run (vs. a static/absent check)? */
  assertionRan: boolean
  /** The assertion verdict, ONLY meaningful when assertionRan is true. */
  assertionPassed?: boolean
}

export interface ClaimStateResult {
  state: ClaimState
  satisfied: boolean
  reason: string
}

/**
 * Derive the claim state from raw evidence. Precedence reports the EARLIEST real defect
 * so a claim can never fall through to PASS on a broken pipeline:
 *   notApplicable → blocked → executionError → evaluatorCrashed → lab-not-executed →
 *   lab-not-certified → expected-evidence-absent → evidence-stale → assertion verdict.
 * Only a run+certified+present+fresh+passing assertion yields CLAIM_PROVEN_PASS.
 */
export function deriveClaimState(input: ClaimEvidenceInput): ClaimStateResult {
  const r = (state: ClaimState, reason: string): ClaimStateResult =>
    ({ state, satisfied: isClaimSatisfied(state), reason })

  if (input.notApplicable) {
    return input.naProof && input.naProof.trim()
      ? r('CLAIM_NOT_APPLICABLE_WITH_PROOF', `not applicable: ${input.naProof}`)
      // N/A without proof is NOT a free pass — it collapses to UNKNOWN, not satisfied.
      : r('CLAIM_UNKNOWN', 'claimed not-applicable without a proof — treated as UNKNOWN, not satisfied')
  }
  if (input.blocked) return r('CLAIM_BLOCKED', 'an upstream blocker prevented evaluation')
  if (input.executionError) return r('CLAIM_EXECUTION_ERROR', 'the evaluation errored before producing a verdict')
  if (input.evaluatorCrashed) return r('CLAIM_EVALUATOR_CRASHED', 'the evaluator crashed — not a normal FAIL')
  if (!input.labExecuted) return r('CLAIM_LAB_NOT_EXECUTED', 'the lab/evaluator did not run for this claim')
  if (!input.labCertified) return r('CLAIM_LAB_NOT_PROVEN', 'the lab is not certified to discriminate for this scope')
  if (!input.expectedEvidencePresent) return r('CLAIM_EXPECTED_EVIDENCE_ABSENT', 'the expected evidence artifact is absent')
  if (!input.evidenceFresh) return r('CLAIM_EVIDENCE_STALE', 'evidence is not bound-fresh to the current candidate')
  if (!input.assertionRan) return r('CLAIM_UNKNOWN', 'no concrete assertion ran — state is UNKNOWN, not PASS')
  if (input.assertionPassed === true) return r('CLAIM_PROVEN_PASS', 'a certified lab produced fresh evidence and the assertion passed')
  if (input.assertionPassed === false) return r('CLAIM_PROVEN_FAIL', 'a certified lab produced fresh evidence and the assertion failed')
  return r('CLAIM_UNKNOWN', 'assertion ran but produced no boolean verdict — UNKNOWN, not PASS')
}

/**
 * The ONLY two states that count a claim as met. Everything else — including a bare FAIL,
 * a crash, staleness, or unknown — is NOT satisfied. This is the anti-collapse invariant.
 */
export function isClaimSatisfied(state: ClaimState): boolean {
  return state === 'CLAIM_PROVEN_PASS' || state === 'CLAIM_NOT_APPLICABLE_WITH_PROOF'
}

/**
 * Anti-collapse guard: prove no non-proven state is being silently normalized to satisfied.
 * Returns the states that WOULD be wrongly counted as met under a candidate predicate —
 * empty means the predicate is honest. Used by the adversarial suite to forbid optimism.
 */
export function collapseViolations(satisfiedPredicate: (s: ClaimState) => boolean): ClaimState[] {
  return ALL_CLAIM_STATES.filter((s) => satisfiedPredicate(s) && !isClaimSatisfied(s))
}
