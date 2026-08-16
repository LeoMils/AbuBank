/*
 * CONTROL COMPLETENESS — the control plane must KNOW what prose knows.  (Stage 3C §9–12)
 * ════════════════════════════════════════════════════════════════════════════════════
 * A release-critical weakness that is known in prose but ABSENT from deterministic
 * state is itself a control defect (§12). Stages 1–3 established, in prose, that the
 * product representation is incomplete: there is no certified capability manifest, no
 * certified denominator, no certified labs, no source-attestation, no SW-runtime
 * provenance. This module makes those gaps DETERMINISTIC so a future GO is impossible
 * while any release-critical control prerequisite is unproven.
 *
 * Two completeness directions (§9):
 *   A. DECLARED   — every release-critical control component maps to a required claim.
 *   B. DECISION-PATH — a component in the release-decision trust root (the frozen
 *      CONTROL_PLANE_IDENTITY component set) that is ABSENT from the claim model is
 *      CONTROL_DECISION_DEPENDENCY_UNDECLARED (pass-by-omission moved up a level).
 *
 * This is PURE and unit-falsified (controlCompleteness.test.ts).
 */

// ── Control prerequisite state (§20 analogue at the control level) ───────────
export type ControlClaimState =
  | 'PROVEN'          // certified + evidence fresh + admissible
  | 'NOT_PROVEN'      // the control exists but its certification/evidence is absent
  | 'NOT_EXECUTED'    // never run
  | 'INVALIDATED'     // certified once, but a material dependency changed since
  | 'NOT_APPLICABLE_WITH_PROOF'

export interface ControlComponent {
  /** Path or logical id of the release-critical control component. */
  id: string
  /** True iff this component can materially change release eligibility. */
  releaseCritical: boolean
  /** The required-control-claim id it must map to (empty ⇒ uncovered). */
  requiredClaim: string
}

export interface ControlClaim {
  id: string
  invariant: string
  /** The component id whose behavior this claim certifies (must exist). */
  component: string
  releaseCritical: boolean
  state: ControlClaimState
  /** Certified component hash; a live hash mismatch ⇒ INVALIDATED. */
  certifiedComponentHash?: string
  liveComponentHash?: string
  evidenceRef?: string
}

export interface ControlCompletenessInput {
  /** The authoritative control-invariant/component model. */
  components: ControlComponent[]
  claims: ControlClaim[]
  /**
   * The trust-root component set (the frozen CONTROL_PLANE_IDENTITY components).
   * Any of these NOT represented by a control component is an undeclared decision
   * dependency — the manifest cannot self-authorize its own completeness (§9).
   */
  trustRootComponents: string[]
}

export interface ControlCompletenessBlocker { code: string; reason: string }

export interface ControlCompletenessResult {
  blockers: ControlCompletenessBlocker[]
  /** True iff any release-critical control prerequisite is not PROVEN. */
  modelIncomplete: boolean
  distribution: Record<string, number>
}

/**
 * Evaluate control completeness. Fails closed: an unproven release-critical control
 * claim, an uncovered component, an orphan claim, an invalidated certification, or an
 * undeclared decision dependency each block. A non-release-critical helper must NOT
 * create a blocker (specificity — else engineers route around the mechanism, §11 CC3).
 */
export function evaluateControlCompleteness(input: ControlCompletenessInput): ControlCompletenessResult {
  const b: ControlCompletenessBlocker[] = []
  const add = (code: string, reason: string) => b.push({ code, reason })
  const claimById = new Map(input.claims.map((c) => [c.id, c]))
  const componentIds = new Set(input.components.map((c) => c.id))
  const distribution: Record<string, number> = {}
  const bump = (s: string) => { distribution[s] = (distribution[s] ?? 0) + 1 }

  // (A) DECLARED completeness — every release-critical component maps to a claim,
  //     and that claim exists. A non-critical component with no claim is fine (CC3).
  for (const comp of input.components) {
    if (!comp.releaseCritical) continue
    if (!comp.requiredClaim || !comp.requiredClaim.trim()) {
      add('CONTROL_PREREQUISITE_UNCOVERED', `release-critical control component '${comp.id}' has no required-control claim`)
      continue
    }
    if (!claimById.has(comp.requiredClaim)) {
      add('CONTROL_PREREQUISITE_UNCOVERED', `component '${comp.id}' names claim '${comp.requiredClaim}' which is not defined`)
    }
  }

  // (B) ORPHAN claims — a required-control claim whose component vanished.
  for (const claim of input.claims) {
    if (!componentIds.has(claim.component)) {
      add('ORPHAN_CONTROL_CLAIM', `control claim '${claim.id}' references component '${claim.component}' which no longer exists`)
    }
    // (C) Certification invalidation — a material component change since certification.
    if (claim.certifiedComponentHash !== undefined && claim.liveComponentHash !== undefined
      && claim.certifiedComponentHash !== claim.liveComponentHash) {
      add('CONTROL_EVIDENCE_INVALIDATED', `control component '${claim.component}' changed since certification of '${claim.id}'`)
    }
  }

  // (D) DECISION-PATH completeness — a trust-root component absent from the claim model.
  const componentsByPathTail = input.components.map((c) => c.id)
  for (const tr of input.trustRootComponents) {
    const covered = componentsByPathTail.some((cid) => cid === tr || cid.endsWith(tr) || tr.endsWith(cid))
    if (!covered) {
      add('CONTROL_DECISION_DEPENDENCY_UNDECLARED', `trust-root component '${tr}' is not represented in the control-claim model`)
    }
  }

  // (E) MODEL INCOMPLETE — any release-critical control claim not PROVEN blocks GO.
  //     This is where prose-known gaps (capability manifest, denominator, labs, …)
  //     become deterministic: as long as they are NOT_PROVEN, release cannot advance.
  let modelIncomplete = false
  for (const claim of input.claims) {
    bump(claim.state)
    if (!claim.releaseCritical) continue
    if (claim.state !== 'PROVEN' && claim.state !== 'NOT_APPLICABLE_WITH_PROOF') {
      add('CONTROL_MODEL_INCOMPLETE', `release-critical control claim '${claim.id}' is ${claim.state} (invariant: ${claim.invariant})`)
      modelIncomplete = true
    }
  }

  return { blockers: b, modelIncomplete, distribution }
}

/**
 * The AUTHORITATIVE control-invariant/component model for AbuBank's release control.
 * The `state` fields here are the DEFAULT (unproven) shape; the live adapter overrides
 * them with real evidence. New release-critical control domains are added HERE, which
 * is the single place the required-control-claim set is derived from (§10) — never a
 * remembered list scattered across code.
 */
export function defaultControlModel(): ControlCompletenessInput {
  const components: ControlComponent[] = [
    { id: 'src/engineering-os/releaseGate.ts', releaseCritical: true, requiredClaim: 'release-gate-falsifiable' },
    { id: 'src/engineering-os/releaseControlPlane.ts', releaseCritical: true, requiredClaim: 'meta-gate-falsifiable' },
    { id: 'src/engineering-os/liveSnapshot.ts', releaseCritical: true, requiredClaim: 'live-adapter-falsifiable' },
    { id: 'src/engineering-os/controlCompleteness.ts', releaseCritical: true, requiredClaim: 'control-completeness-falsifiable' },
    // Prose-known-but-unproven release prerequisites — now first-class control claims:
    { id: 'capability-manifest-generator', releaseCritical: true, requiredClaim: 'capability-manifest-certified' },
    { id: 'acceptance-denominator', releaseCritical: true, requiredClaim: 'denominator-certified' },
    { id: 'lab-certification', releaseCritical: true, requiredClaim: 'lab-certification-complete' },
    { id: 'deployment-source-attestation', releaseCritical: true, requiredClaim: 'deployment-attested' },
    { id: 'service-worker-runtime-provenance', releaseCritical: true, requiredClaim: 'sw-runtime-proven' },
    { id: 'privacy-security-control', releaseCritical: true, requiredClaim: 'privacy-control-proven' },
  ]
  const claim = (id: string, invariant: string, component: string, state: ControlClaimState): ControlClaim =>
    ({ id, invariant, component, releaseCritical: true, state })
  const claims: ControlClaim[] = [
    claim('release-gate-falsifiable', 'GATE D rejects every seeded false-ready state', 'src/engineering-os/releaseGate.ts', 'NOT_PROVEN'),
    claim('meta-gate-falsifiable', 'meta-gate rejects spec-derived false-ready fixtures', 'src/engineering-os/releaseControlPlane.ts', 'NOT_PROVEN'),
    claim('live-adapter-falsifiable', 'live adapter blocks on missing/malformed/stale/conflicting sources', 'src/engineering-os/liveSnapshot.ts', 'NOT_PROVEN'),
    claim('control-completeness-falsifiable', 'control-completeness detects uncovered/orphan/undeclared/incomplete', 'src/engineering-os/controlCompleteness.ts', 'NOT_PROVEN'),
    claim('capability-manifest-certified', 'canonical product capability manifest is discovered + drift-proven', 'capability-manifest-generator', 'NOT_PROVEN'),
    claim('denominator-certified', 'acceptance denominator is complete + monotonic + specificity-proven', 'acceptance-denominator', 'NOT_PROVEN'),
    claim('lab-certification-complete', 'every release-critical lab has PROVEN sensitivity/restoration/specificity', 'lab-certification', 'NOT_PROVEN'),
    claim('deployment-attested', 'deployed source identity binds to the certified candidate SHA', 'deployment-source-attestation', 'NOT_PROVEN'),
    claim('sw-runtime-proven', 'the warm/fresh PWA client actually serves the certified bundle', 'service-worker-runtime-provenance', 'NOT_PROVEN'),
    claim('privacy-control-proven', 'required privacy/security control executed + current', 'privacy-security-control', 'NOT_PROVEN'),
  ]
  return { components, claims, trustRootComponents: [] }
}
