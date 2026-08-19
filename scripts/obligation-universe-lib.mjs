/*
 * obligation-universe-lib.mjs — PURE meta-completeness of the obligation UNIVERSE. (§3 / C10 meta)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The Machine Work registry is omission-proof against its universe (REQUIRED_OBLIGATION_IDS), but that
 * universe must ITSELF be cross-checked against an INDEPENDENT constitutional source, or the same
 * omission class recurs one level up. This cross-checks two independently-maintained views:
 *   view A: REQUIRED_OBLIGATION_IDS (implementation, in machine-work-graph-lib.mjs)
 *   view B: CONSTITUTIONAL_OBLIGATIONS.json (constitutional requirements, by § section)
 * A mismatch in EITHER direction blocks. No I/O.
 */
export function deriveUniverseCompleteness(requiredIds = [], constitutional = []) {
  const reqSet = new Set(requiredIds)
  const constSet = new Set(constitutional.map((c) => c.obligationId))
  const relevant = constitutional.filter((c) => c.releaseRelevant !== false)

  // SENSITIVITY: a release-relevant constitutional obligation absent from the implementation universe.
  const missingFromUniverse = relevant.filter((c) => !reqSet.has(c.obligationId)).map((c) => c.obligationId)
  // No orphan release blockers: an implementation obligation with no constitutional backing.
  const orphanRequired = requiredIds.filter((id) => !constSet.has(id))
  // SPECIFICITY: an explicitly non-release-relevant item must NOT be a mandatory obligation.
  const falseMandatory = constitutional.filter((c) => c.releaseRelevant === false && reqSet.has(c.obligationId)).map((c) => c.obligationId)

  const ok = missingFromUniverse.length === 0 && orphanRequired.length === 0 && falseMandatory.length === 0
  return {
    OBLIGATION_UNIVERSE_COMPLETENESS: ok ? 'PROVEN' : 'NOT_PROVEN',
    constitutionalRelevantTotal: relevant.length,
    implementationUniverseTotal: requiredIds.length,
    missingFromUniverse, orphanRequired, falseMandatory, ok,
  }
}
