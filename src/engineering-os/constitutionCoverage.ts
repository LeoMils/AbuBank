/*
 * CONSTITUTION COVERAGE ORACLE — is the invariant SET itself complete? (§4–6)
 * ══════════════════════════════════════════════════════════════════════════
 * Obligation-first completeness closed the implementation-layer negative space.
 * A bounded trust-root question remains: what proves the constitutional invariant
 * SET is sufficient? Answer WITHOUT infinite recursion: cross-check the invariants
 * against INDEPENDENT calibration probes (release exit contract, product North Star,
 * capability/risk families, historical QA escapes, repo security/privacy/provenance
 * specs, owner-firewall). These probes do NOT auto-become invariants — they ask
 * "which invariant governs this?". If none: CONSTITUTIONAL_COVERAGE_GAP.
 *
 * Sensitivity AND specificity: a release-critical requirement with no governing
 * invariant is a gap; irrelevant historical trivia must NOT create a meaningless
 * invariant. Expected coverage is derived from the probes, NOT from the constitution
 * under test (no common-mode).
 */

export type ProbeSource =
  | 'RELEASE_EXIT_CONTRACT'
  | 'PRODUCT_NORTH_STAR'
  | 'CAPABILITY_RISK_FAMILY'
  | 'HISTORICAL_ESCAPE'
  | 'REPO_SECURITY_PRIVACY_SPEC'
  | 'OWNER_FIREWALL'

export interface CalibrationProbe {
  id: string
  source: ProbeSource
  requirement: string
  releaseCritical: boolean
  /** The constitutional invariant id the probe asserts should govern it (or absent). */
  governingInvariant?: string
}

export interface ConstitutionCoverageInput {
  invariantIds: string[]
  probes: CalibrationProbe[]
}
export interface CoverageBlocker { code: string; reason: string }
export interface ConstitutionCoverageResult { blockers: CoverageBlocker[]; distribution: Record<string, number> }

export function evaluateConstitutionCoverage(input: ConstitutionCoverageInput): ConstitutionCoverageResult {
  const inv = new Set(input.invariantIds)
  const blockers: CoverageBlocker[] = []
  const distribution: Record<string, number> = { GOVERNED: 0, GAP: 0, NON_CRITICAL: 0 }
  for (const p of input.probes) {
    if (!p.releaseCritical) { distribution.NON_CRITICAL!++; continue }
    if (!p.governingInvariant || !inv.has(p.governingInvariant)) {
      blockers.push({ code: 'CONSTITUTIONAL_COVERAGE_GAP', reason: `${p.source} requirement '${p.id}' ("${p.requirement}") has no governing constitutional invariant` })
      distribution.GAP!++
    } else {
      distribution.GOVERNED!++
    }
  }
  return { blockers, distribution }
}

/**
 * Independent calibration probes derived from sources OTHER than the constitution.
 * Each asserts which of the 15 invariants (obligationCompleteness.ts) governs it. If
 * this set were to name a requirement no invariant governs, that is a real gap.
 */
export function defaultCalibrationProbes(): CalibrationProbe[] {
  const p = (id: string, source: ProbeSource, requirement: string, gov: string): CalibrationProbe =>
    ({ id, source, requirement, releaseCritical: true, governingInvariant: gov })
  return [
    // Release exit contract (§41 conditions) → invariants.
    p('exit-no-false-ready', 'RELEASE_EXIT_CONTRACT', 'gate rejects false-ready', 'gate-falsifiable'),
    p('exit-no-silent-normalize', 'RELEASE_EXIT_CONTRACT', 'no silent normalization of missing state', 'live-no-silent-default'),
    p('exit-capability-certified', 'RELEASE_EXIT_CONTRACT', 'capability universe certified', 'capability-universe'),
    p('exit-denominator-certified', 'RELEASE_EXIT_CONTRACT', 'denominator certified', 'denominator'),
    p('exit-labs-proven', 'RELEASE_EXIT_CONTRACT', 'labs prove discrimination', 'lab-certification'),
    p('exit-evidence-fresh', 'RELEASE_EXIT_CONTRACT', 'evidence reproducible + fresh', 'evidence-producers'),
    p('exit-attestation', 'RELEASE_EXIT_CONTRACT', 'source→deploy attested', 'deployment-attestation'),
    p('exit-sw', 'RELEASE_EXIT_CONTRACT', 'warm PWA runtime proven', 'sw-runtime-provenance'),
    p('exit-privacy', 'RELEASE_EXIT_CONTRACT', 'privacy/security proven', 'privacy-security'),
    p('exit-ci', 'RELEASE_EXIT_CONTRACT', 'remote release CI enforces BLOCKED', 'release-ci-enforcement'),
    p('exit-claimstate', 'RELEASE_EXIT_CONTRACT', 'non-collapsible claim states', 'claim-state-model'),
    // North Star.
    p('north-machine-first', 'PRODUCT_NORTH_STAR', 'machine finds automatable defects before Leo', 'capability-universe'),
    // Owner firewall.
    p('owner-machine-derived', 'OWNER_FIREWALL', 'owner handoff machine-derived', 'owner-firewall'),
    // Historical escape classes (calibration; each needs a governing invariant so a
    // detector can be REQUIRED). These map to capability-universe / denominator, which
    // demand the surfaces + claim families that would carry their detectors.
    p('esc-kinship', 'HISTORICAL_ESCAPE', 'wrong family/kinship answer', 'denominator'),
    p('esc-time', 'HISTORICAL_ESCAPE', 'wrong current-time / tool routing', 'denominator'),
    p('esc-cache', 'HISTORICAL_ESCAPE', 'current-info cache contamination', 'denominator'),
    p('esc-voice-nospeak', 'HISTORICAL_ESCAPE', 'voice no-speak / barge-in', 'capability-universe'),
    p('esc-parse-default', 'HISTORICAL_ESCAPE', 'silent JSON parse/default', 'live-no-silent-default'),
    // Repo security/privacy spec.
    p('sec-no-client-secret', 'REPO_SECURITY_PRIVACY_SPEC', 'billable keys never in client bundle', 'privacy-security'),
    p('sec-no-phone-in-memory', 'REPO_SECURITY_PRIVACY_SPEC', 'no phone/medical/financial in memory', 'privacy-security'),
  ]
}
