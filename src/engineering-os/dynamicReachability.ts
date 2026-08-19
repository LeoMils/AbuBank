/*
 * STATIC↔DYNAMIC REACHABILITY RECONCILIATION CORE (o-capability, dynamic).  (Stage 3C §4–5)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * The static producer is now source-complete (6 signals → 41 provisional capabilities). That
 * set stays PROVISIONAL until reconciled against what is actually reachable at runtime on the
 * deployed candidate. This module is the SINGLE shared reconciliation implementation used by
 * BOTH paths (§3 path-equivalence):
 *   • DETECTOR_CALIBRATION_TARGET — isolated fixtures with controlled observed-sets, to prove
 *     the detector's sensitivity / specificity / restoration WITHOUT mutating the real RC.
 *   • PRODUCT_ACCEPTANCE_TARGET   — the real observed-set captured read-only from the exact
 *     deployed RC.
 * Only the `observed` INPUT differs; the classification/normalization/reconciliation code below
 * is identical, so calibration on the isolated target is path-equivalent to the real run.
 *
 * Cardinal rules (§5):
 *   • A DYNAMIC-ONLY capability (observed, absent from static) is a real static OMISSION.
 *   • A STATIC-ONLY user capability must NOT be dropped merely because the crawler did not
 *     exercise its enabling state — that is STATE_COVERAGE_INCOMPLETE (expand coverage), not
 *     proof of INTERNAL.
 *   • An internal helper may be excluded ONLY with a machine-recorded proof.
 */

export type ReconciliationState =
  | 'STATIC_AND_DYNAMIC_CONFIRMED'
  | 'STATIC_ONLY_WITH_VALID_EXPLANATION'
  | 'DYNAMIC_ONLY_CAPABILITY_OMISSION'
  | 'STATE_COVERAGE_INCOMPLETE'
  | 'INTERNAL_WITH_PROOF'
  | 'UNKNOWN'

/** Per-static-capability reconciliation hints (from the state matrix + classification). */
export interface CapabilityReconInput {
  id: string
  /** Present in the static (source-complete) manifest. */
  inStatic: boolean
  /** Observed reachable at runtime in the exercised state matrix. */
  observedReachable: boolean
  /** Was the capability's enabling state actually exercised by the crawler? */
  enablingStateExercised?: boolean
  /** A machine-recorded proof the capability is internal (excludes it from the universe). */
  internalProof?: string
  /** A recorded explanation for a static-only-but-exercised absence (e.g. gated by owner ear). */
  validExplanation?: string
}

export interface CapabilityReconResult {
  id: string
  state: ReconciliationState
  /** Whether the capability belongs to the canonical product universe. */
  inCanonicalUniverse: boolean
  reason: string
}

/** Reconcile ONE capability. Pure; identical for calibration and real runs. */
export function reconcileCapability(c: CapabilityReconInput): CapabilityReconResult {
  const mk = (state: ReconciliationState, inCanonicalUniverse: boolean, reason: string): CapabilityReconResult =>
    ({ id: c.id, state, inCanonicalUniverse, reason })

  if (c.observedReachable && c.inStatic) return mk('STATIC_AND_DYNAMIC_CONFIRMED', true, 'present in static manifest and observed reachable at runtime')
  if (c.observedReachable && !c.inStatic) return mk('DYNAMIC_ONLY_CAPABILITY_OMISSION', true, 'observed reachable but ABSENT from the static manifest — static discovery is incomplete; add it')

  // Not observed reachable.
  if (c.inStatic) {
    if (c.internalProof && c.internalProof.trim()) return mk('INTERNAL_WITH_PROOF', false, `not user-reachable, proven internal: ${c.internalProof}`)
    if (!c.enablingStateExercised) return mk('STATE_COVERAGE_INCOMPLETE', true, 'static capability whose enabling state was not exercised — expand coverage; NOT proof of internal')
    if (c.validExplanation && c.validExplanation.trim()) return mk('STATIC_ONLY_WITH_VALID_EXPLANATION', true, `exercised but not observed, with explanation: ${c.validExplanation}`)
    return mk('UNKNOWN', true, 'exercised, not observed, no internal proof and no valid explanation — a conflict to resolve; conservatively included')
  }
  return mk('UNKNOWN', true, 'neither static nor observed — under-specified; conservatively included')
}

export interface ReconciliationReport {
  results: CapabilityReconResult[]
  distribution: Record<ReconciliationState, number>
  blockers: { code: string; reason: string }[]
  /** True iff the universe is proven canonical: no omissions, no unknowns, no incomplete state coverage. */
  canonicalProven: boolean
  /** The canonical universe ids (everything except proven-internal). */
  canonicalUniverse: string[]
}

/**
 * Reconcile the full set. o-capability may be PROVEN only when the report has ZERO
 * DYNAMIC_ONLY_CAPABILITY_OMISSION, ZERO UNKNOWN, and ZERO STATE_COVERAGE_INCOMPLETE —
 * i.e. every static capability is confirmed / explained / proven-internal and every
 * observed capability is in static.
 */
export function reconcile(inputs: CapabilityReconInput[]): ReconciliationReport {
  const results = inputs.map(reconcileCapability)
  const distribution = {
    STATIC_AND_DYNAMIC_CONFIRMED: 0, STATIC_ONLY_WITH_VALID_EXPLANATION: 0,
    DYNAMIC_ONLY_CAPABILITY_OMISSION: 0, STATE_COVERAGE_INCOMPLETE: 0,
    INTERNAL_WITH_PROOF: 0, UNKNOWN: 0,
  } as Record<ReconciliationState, number>
  for (const r of results) distribution[r.state]++

  const blockers: { code: string; reason: string }[] = []
  for (const r of results) {
    if (r.state === 'DYNAMIC_ONLY_CAPABILITY_OMISSION') blockers.push({ code: 'DYNAMIC_ONLY_CAPABILITY_OMISSION', reason: `${r.id}: ${r.reason}` })
    if (r.state === 'STATE_COVERAGE_INCOMPLETE') blockers.push({ code: 'STATE_COVERAGE_INCOMPLETE', reason: `${r.id}: ${r.reason}` })
    if (r.state === 'UNKNOWN') blockers.push({ code: 'RECONCILIATION_UNKNOWN', reason: `${r.id}: ${r.reason}` })
  }
  const canonicalProven = blockers.length === 0
  const canonicalUniverse = results.filter((r) => r.inCanonicalUniverse).map((r) => r.id).sort()
  return { results, distribution, blockers, canonicalProven, canonicalUniverse }
}
