/*
 * release-eligibility-lib.mjs — PURE release state machine. (§2 reconciliation)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * PRODUCTION_PROMOTION_ELIGIBLE is DERIVED, never prose-set. It is NO while ANY release-blocking owner
 * action or required human residual remains open — even when machine certification is complete. No I/O.
 */
export function deriveReleaseEligibility({ machineReady, ownerActions = [], humanResiduals = [] } = {}) {
  // Owner actions that block promotion: anything whose releaseBlocking is truthy and not 'none'.
  const blockingOwner = ownerActions.filter((o) => o.releaseBlocking && o.releaseBlocking !== 'none').map((o) => o.id)
  // Human residuals block by DEFAULT (they represent real behaviour not machine-verified); only an
  // explicit releaseBlocking:false (with justification) removes one. We do NOT weaken this to gain green.
  const blockingHuman = humanResiduals.filter((h) => h.releaseBlocking !== false).map((h) => h.id)

  const MACHINE_RELEASE_READINESS = machineReady ? 'READY' : 'NOT_READY'
  const PRODUCTION_PROMOTION_ELIGIBLE = (machineReady && blockingOwner.length === 0 && blockingHuman.length === 0) ? 'YES' : 'NO'

  let RELEASE_PROMOTION_VERDICT
  if (!machineReady) RELEASE_PROMOTION_VERDICT = 'NOT_YET'
  else if (PRODUCTION_PROMOTION_ELIGIBLE === 'YES') RELEASE_PROMOTION_VERDICT = 'ELIGIBLE'
  else RELEASE_PROMOTION_VERDICT = 'ELIGIBLE_PENDING_OWNER'

  return {
    MACHINE_RELEASE_READINESS,
    BLOCKING_OWNER_ACTIONS_REMAINING: blockingOwner.length,
    BLOCKING_HUMAN_RESIDUALS_REMAINING: blockingHuman.length,
    blockingOwner, blockingHuman,
    PRODUCTION_PROMOTION_ELIGIBLE,
    RELEASE_PROMOTION_VERDICT,
  }
}
