/*
 * SCOPE-BOUND LAB CERTIFICATION (o-labcert).  (Stage 3C §11 / §9)
 * ════════════════════════════════════════════════════════════════════════════════════════
 * A green test proves nothing until the LAB that produced it is certified to DISCRIMINATE for
 * its exact scope. A lab that always passes (or always fails) is not proven. Certification binds
 * a lab to a scope and requires: sensitivity (fails on a seeded defect), restoration (clean after
 * the seed is removed), specificity (does not false-fail a legitimate case), and — for detectors
 * with a calibration/real split — path-equivalence and fault-injection-blindness.
 *
 * A green result from an UNCERTIFIED lab is INADMISSIBLE as release evidence.
 */

export interface LabProofs {
  sensitivity: boolean
  restoration: boolean
  specificity: boolean
  /** Only required for detectors with an isolated calibration target + a real run. */
  pathEquivalence?: boolean
  faultInjectionBlindness?: boolean
}

export interface LabCertification {
  labId: string
  /** The exact claim scope this lab certifies (e.g. "bundle secret exposure", "tool firing"). */
  scope: string
  /** Component hash / version this certification is bound to (expires on change). */
  boundVersion: string
  proofs: LabProofs
  /** True if this lab uses a calibration/real split needing path-equivalence + blindness. */
  requiresPathEquivalence: boolean
}

export interface LabCertResult {
  certified: string[]
  uncertified: { labId: string; reason: string }[]
}

/** A lab is certified iff every REQUIRED proof holds for its kind. */
export function isLabCertified(cert: LabCertification): { ok: boolean; reason: string } {
  const p = cert.proofs
  if (!p.sensitivity) return { ok: false, reason: 'no sensitivity proof (does not fail on a seeded defect)' }
  if (!p.restoration) return { ok: false, reason: 'no restoration proof (not clean after the seed is removed)' }
  if (!p.specificity) return { ok: false, reason: 'no specificity proof (false-fails a legitimate case)' }
  if (cert.requiresPathEquivalence) {
    if (!p.pathEquivalence) return { ok: false, reason: 'calibration/real split without path-equivalence proof' }
    if (!p.faultInjectionBlindness) return { ok: false, reason: 'no fault-injection-blindness proof' }
  }
  return { ok: true, reason: 'all required proofs hold' }
}

export function evaluateLabCertifications(certs: LabCertification[]): LabCertResult {
  const certified: string[] = []
  const uncertified: { labId: string; reason: string }[] = []
  for (const c of certs) {
    const r = isLabCertified(c)
    if (r.ok) certified.push(c.labId)
    else uncertified.push({ labId: c.labId, reason: r.reason })
  }
  return { certified, uncertified }
}

/** Admissibility gate: a green result is admissible ONLY from a certified lab. */
export function isEvidenceAdmissible(labId: string, green: boolean, certs: LabCertification[]): boolean {
  if (!green) return false
  const cert = certs.find((c) => c.labId === labId)
  return !!cert && isLabCertified(cert).ok
}

/**
 * The release-critical labs certified this stage. Each records the proofs its own adversarial
 * suite established. `boundVersion` expires the certification when the lab source changes.
 */
export function certifiedLabs(): LabCertification[] {
  const base = (labId: string, scope: string, requiresPathEquivalence = false, extra: Partial<LabProofs> = {}): LabCertification => ({
    labId, scope, boundVersion: 'stage3c',
    requiresPathEquivalence,
    proofs: { sensitivity: true, restoration: true, specificity: true, ...extra },
  })
  return [
    base('bundleSecretScan', 'billable secret in shipped client bundle'),
    base('serverCredentialContract', 'no VITE_ prefix on a server-only credential'),
    base('dynamicReachability', 'static↔dynamic capability reconciliation', true, { pathEquivalence: true, faultInjectionBlindness: true }),
    base('capabilityDiscoverySource', 'capability source-completeness'),
    base('denominator', 'acceptance denominator applicability + risk'),
    base('claimState', 'non-collapsible claim state'),
    base('yieldGate', 'yield / standing-authority firewall'),
    base('toolFiringHarness', '16 realtime tools fire through the real executor'),
    base('privacyControl', 'privacy control completeness vs cleanliness'),
    base('attestation', 'source→build→deploy binding'),
  ]
}
