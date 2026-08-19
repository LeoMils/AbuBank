/*
 * oracle-discipline-lib.mjs — PURE test/oracle integrity (§20/B5) + negative-proof protocol (§25).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * No I/O.
 */
// §20 · Oracle hierarchy — lower index = stronger. A release-critical claim should prefer the strongest.
export const ORACLE_HIERARCHY = [
  'AUTHORITATIVE_DETERMINISTIC', 'INVARIANT', 'STATE_SIDE_EFFECT', 'METAMORPHIC', 'INDEPENDENT_SEMANTIC_JUDGE',
]
export function oracleRank(kind) { const i = ORACLE_HIERARCHY.indexOf(kind); return i < 0 ? Infinity : i }

// §20 · When product + its release-relevant detector change together, calibration is REQUIRED and must
// pass the full sequence; a fixer may not weaken its own detector to reach green.
export function calibrationValid(cal = {}) {
  const reasons = []
  if (cal.detectorChangedWithProduct !== true) return { required: false, valid: true, reasons: ['detector not co-changed'] }
  if (cal.controlledNegativeFailedForRightReason !== true) reasons.push('missing controlled-negative → FAIL for intended reason')
  if (cal.restoredToPass !== true) reasons.push('missing restoration → PASS')
  if (cal.nearNeighbourSpecificity !== true) reasons.push('missing near-neighbour specificity check')
  if (cal.contractMapping !== true) reasons.push('missing contract mapping')
  return { required: true, valid: reasons.length === 0, reasons }
}

// §25 · Negative-proof protocol — a human/device residual is only valid after strongest machine routes
// were attempted AND the exact irreducible remainder is named.
export const MACHINE_ROUTES = ['browser-automation', 'real-client-lifecycle-injected-events', 'mock-transport-through-handler', 'flightrecorder-replay', 'event-stream-replay']
export function negativeProofComplete(residual = {}) {
  const reasons = []
  const attempted = residual.machineApproachesAttempted ?? []
  if (!Array.isArray(attempted) || attempted.length === 0) reasons.push('no machine routes attempted')
  if (!residual.exactIrreducibleRemainder) reasons.push('exact irreducible remainder not named')
  if (!residual.reviewTrigger) reasons.push('no review/expiry trigger (residuals must not be permanent)')
  return { valid: reasons.length === 0, reasons }
}
