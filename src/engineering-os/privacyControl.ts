/*
 * PRIVACY / SECURITY RELEASE CONTROL (o-privacy).  (Stage 3C §10)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * Aggregates the EXECUTED privacy/security checks into one release-control verdict. The
 * invariant is "required privacy/security control executed + current" — this module makes that
 * machine-evaluable. Crucially, a control that EXECUTED and found a leak is IMPLEMENTED and
 * WORKING; the finding is a RELEASE blocker, not evidence the control is absent. (The 0.286
 * shipped-bundle key exposure is exactly such a finding.)
 *
 * Checks aggregated:
 *   • shipped-artifact secret scan (bundleSecretScan / scan-deployed-secrets) — no billable
 *     credential in the shipped client bundle.
 *   • server-credential contract — no server-only key read via a VITE_ prefix (serverCredentialContract).
 *   • memory/log PII boundary — no phone/medical/financial/street in client artifacts.
 */

export type PrivacyCheckId =
  | 'SHIPPED_ARTIFACT_SECRET_SCAN'
  | 'SERVER_CREDENTIAL_CONTRACT'
  | 'CLIENT_PII_BOUNDARY'

export interface PrivacyCheckResult {
  id: PrivacyCheckId
  /** Did the check actually run against the current candidate (not assumed)? */
  executed: boolean
  /** Did it pass (no violation)? Only meaningful when executed. */
  passed: boolean
  /** Machine detail (redacted — never a secret value). */
  detail: string
}

export interface PrivacyControlResult {
  /** True iff every required check EXECUTED against the current candidate. */
  controlExecuted: boolean
  /** True iff every executed check passed (no privacy/security violation). */
  clean: boolean
  /** Release blockers = executed checks that FAILED (the control working, finding real issues). */
  releaseBlockers: { code: string; reason: string }[]
  /** Control-model blockers = required checks that did NOT execute (control incomplete). */
  controlBlockers: { code: string; reason: string }[]
  checks: PrivacyCheckResult[]
}

const REQUIRED_CHECKS: PrivacyCheckId[] = ['SHIPPED_ARTIFACT_SECRET_SCAN', 'SERVER_CREDENTIAL_CONTRACT', 'CLIENT_PII_BOUNDARY']

/**
 * Evaluate the privacy control from the individual check results. Separates:
 *   • control completeness (did every required check run?), and
 *   • release cleanliness (did any executed check find a violation?).
 * o-privacy is IMPLEMENTED when the control is complete; the release is GO on privacy only when
 * the control is complete AND clean.
 */
export function evaluatePrivacyControl(checks: PrivacyCheckResult[]): PrivacyControlResult {
  const byId = new Map(checks.map((c) => [c.id, c]))
  const controlBlockers: { code: string; reason: string }[] = []
  const releaseBlockers: { code: string; reason: string }[] = []

  for (const req of REQUIRED_CHECKS) {
    const c = byId.get(req)
    if (!c || !c.executed) {
      controlBlockers.push({ code: 'PRIVACY_CHECK_NOT_EXECUTED', reason: `required privacy check '${req}' did not execute against the current candidate` })
      continue
    }
    if (!c.passed) releaseBlockers.push({ code: 'PRIVACY_VIOLATION', reason: `${req}: ${c.detail}` })
  }

  const controlExecuted = controlBlockers.length === 0
  const clean = controlExecuted && releaseBlockers.length === 0
  return { controlExecuted, clean, releaseBlockers, controlBlockers, checks }
}
