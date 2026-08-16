/*
 * OBLIGATION-FIRST CONTROL COMPLETENESS.  (Stage 3C §7–12)
 * ════════════════════════════════════════════════════════
 * Component-based completeness (controlCompleteness.ts) can detect an EXISTING
 * release-critical component omitted from the claim model. It CANNOT detect a control
 * capability that SHOULD EXIST but is entirely absent — NEGATIVE-SPACE pass-by-omission.
 *
 * The bounded trust root (§8) is the versioned RELEASE CONSTITUTION — a set of
 * invariants that is NOT derived from the implementation under test. The chain is:
 *   CONSTITUTIONAL_INVARIANTS → REQUIRED_CONTROL_OBLIGATIONS → IMPLEMENTATION →
 *   CONTROL_CLAIMS → CONTROL_EVIDENCE.
 * The implementation does not get to decide which obligations ought to exist; the
 * constitution does. An invariant with no derived obligation, or a release-critical
 * obligation with no implementation, blocks.
 */

export interface ConstitutionalInvariant {
  id: string
  statement: string
  /** Semantic version of the constitution entry (§8: material change ⇒ revalidation). */
  version: string
  releaseCritical: boolean
}

export type ObligationImplState =
  | 'IMPLEMENTED_AND_MAPPED'
  | 'IMPLEMENTED_BUT_UNMAPPED'
  | 'UNIMPLEMENTED'
  | 'NOT_APPLICABLE_WITH_PROOF'

export interface ControlObligation {
  id: string
  invariantId: string
  requiredCapability: string
  implState: ObligationImplState
  releaseCritical: boolean
  mappedComponent?: string
  mappedClaim?: string
  /** Required when implState === 'NOT_APPLICABLE_WITH_PROOF'. */
  naProof?: string
}

export interface ObligationCompletenessInput {
  invariants: ConstitutionalInvariant[]
  obligations: ControlObligation[]
  /** Decision-path components (release-eligibility-affecting) that must be covered. */
  decisionPathComponents: string[]
}

export interface ObligationBlocker { code: string; reason: string }
export interface ObligationCompletenessResult {
  blockers: ObligationBlocker[]
  distribution: Record<string, number>
}

/**
 * Evaluate obligation completeness from BOTH directions (§9):
 *  A. OBLIGATION→IMPLEMENTATION — every release-critical obligation maps to an
 *     implementation+claim or is N/A-with-proof.
 *  B. INVARIANT→OBLIGATION — every release-critical invariant derives ≥1 obligation
 *     (else the negative space hides a missing control).
 *  Plus DECISION-PATH — a decision component with no obligation is undeclared.
 */
export function evaluateObligationCompleteness(input: ObligationCompletenessInput): ObligationCompletenessResult {
  const b: ObligationBlocker[] = []
  const add = (code: string, reason: string) => b.push({ code, reason })
  const distribution: Record<string, number> = {}
  const bump = (s: string) => { distribution[s] = (distribution[s] ?? 0) + 1 }

  const obligationsByInvariant = new Map<string, ControlObligation[]>()
  for (const o of input.obligations) {
    const arr = obligationsByInvariant.get(o.invariantId) ?? []
    arr.push(o); obligationsByInvariant.set(o.invariantId, arr)
  }

  // (B) NEGATIVE SPACE — a release-critical invariant with NO obligation derived.
  for (const inv of input.invariants) {
    if (!inv.releaseCritical) continue
    if (!(obligationsByInvariant.get(inv.id)?.length)) {
      add('CONSTITUTIONAL_OBLIGATION_OMITTED', `invariant '${inv.id}' ("${inv.statement}") has no derived control obligation`)
    }
  }

  const invariantIds = new Set(input.invariants.map((i) => i.id))
  const mappedComponents = new Set<string>()
  for (const o of input.obligations) {
    bump(o.implState)
    if (!invariantIds.has(o.invariantId)) {
      add('ORPHAN_CONTROL_OBLIGATION', `obligation '${o.id}' references unknown invariant '${o.invariantId}'`)
    }
    if (o.mappedComponent) mappedComponents.add(o.mappedComponent)
    if (!o.releaseCritical) continue
    switch (o.implState) {
      case 'UNIMPLEMENTED':
        // The prose-known-but-absent control is now a deterministic blocker.
        add('CONTROL_OBLIGATION_UNIMPLEMENTED', `release-critical obligation '${o.id}' (${o.requiredCapability}) is UNIMPLEMENTED`)
        break
      case 'IMPLEMENTED_BUT_UNMAPPED':
        add('CONTROL_PREREQUISITE_UNCOVERED', `obligation '${o.id}' is implemented but maps to no control claim`)
        break
      case 'NOT_APPLICABLE_WITH_PROOF':
        if (!o.naProof || !o.naProof.trim()) add('INVALID_CONTROL_NA', `obligation '${o.id}' marked N/A without proof`)
        break
      case 'IMPLEMENTED_AND_MAPPED':
        if (!o.mappedComponent || !o.mappedClaim) add('CONTROL_PREREQUISITE_UNCOVERED', `obligation '${o.id}' claims mapped but is missing component/claim`)
        break
    }
  }

  // DECISION-PATH — a release-decision component absent from every obligation.
  for (const dp of input.decisionPathComponents) {
    const covered = [...mappedComponents].some((c) => c === dp || c.endsWith(dp) || dp.endsWith(c))
    if (!covered) add('CONTROL_DECISION_DEPENDENCY_UNDECLARED', `decision-path component '${dp}' is not covered by any control obligation`)
  }

  return { blockers: b, distribution }
}

/** True iff any release-critical obligation is unproven/absent (model incomplete). */
export function obligationModelIncomplete(r: ObligationCompletenessResult): boolean {
  return r.blockers.some((x) => x.code === 'CONTROL_OBLIGATION_UNIMPLEMENTED' || x.code === 'CONSTITUTIONAL_OBLIGATION_OMITTED')
}

/**
 * The versioned RELEASE CONSTITUTION for AbuBank + the obligation reality as of Stage
 * 3C. This is the bounded trust root (§8) — invariants are authored from release
 * principles, NOT scraped from the code under test. Obligations record what is actually
 * implemented today; the UNIMPLEMENTED ones are the honest negative space.
 */
export function defaultConstitution(): ObligationCompletenessInput {
  const inv = (id: string, statement: string): ConstitutionalInvariant =>
    ({ id, statement, version: '3c.1', releaseCritical: true })
  const invariants: ConstitutionalInvariant[] = [
    inv('gate-falsifiable', 'the release gate must reject every seeded false-ready state'),
    inv('meta-gate-falsifiable', 'the meta-gate must reject spec-derived false-ready fixtures'),
    inv('live-no-silent-default', 'live state must never normalize missing/malformed/stale sources into false green'),
    inv('control-completeness', 'no release-critical control component may be omitted from the claim model'),
    inv('execution-continuity', 'a NO_GO/BLOCKED release must not stop machine work while machine-closable work remains'),
    inv('yield-continuity', 'the agent must not yield to the user while EXECUTION_STATE=CONTINUE_MACHINE_WORK and a machine-executable next action exists without a genuine boundary'),
    inv('capability-universe', 'the full product capability universe must be discovered (not just screens) and drift-controlled'),
    inv('denominator', 'the acceptance denominator must be complete, monotonic and specificity-proven'),
    inv('claim-state-model', 'claim execution states must be explicit and non-collapsible'),
    inv('lab-certification', 'every release-critical lab must prove useful discrimination for its exact scope'),
    inv('evidence-producers', 'release evidence must be reproducibly generated from real runs with lineage + computed freshness'),
    inv('deployment-attestation', 'the deployed source identity must bind to the certified candidate'),
    inv('sw-runtime-provenance', 'the warm PWA client must be proven to serve the certified bundle'),
    inv('privacy-security', 'required privacy/security controls must be executed and current'),
    inv('release-ci-enforcement', 'a NO_GO/BLOCKED release must fail a remote release-certification check'),
    inv('owner-firewall', 'owner handoff eligibility must be machine-derived, never prose'),
  ]
  const ob = (id: string, invariantId: string, cap: string, implState: ObligationImplState, component?: string, claim?: string): ControlObligation =>
    ({ id, invariantId, requiredCapability: cap, implState, releaseCritical: true, ...(component ? { mappedComponent: component } : {}), ...(claim ? { mappedClaim: claim } : {}) })
  const obligations: ControlObligation[] = [
    ob('o-gate', 'gate-falsifiable', 'falsifiable release gate', 'IMPLEMENTED_AND_MAPPED', 'src/engineering-os/releaseGate.ts', 'release-gate-falsifiable'),
    ob('o-meta', 'meta-gate-falsifiable', 'falsifiable meta-gate', 'IMPLEMENTED_AND_MAPPED', 'src/engineering-os/releaseControlPlane.ts', 'meta-gate-falsifiable'),
    ob('o-live', 'live-no-silent-default', 'strict live adapter', 'IMPLEMENTED_AND_MAPPED', 'src/engineering-os/liveSnapshot.ts', 'live-adapter-falsifiable'),
    ob('o-cc', 'control-completeness', 'component completeness', 'IMPLEMENTED_AND_MAPPED', 'src/engineering-os/controlCompleteness.ts', 'control-completeness-falsifiable'),
    ob('o-exec', 'execution-continuity', 'execution-continuity gate', 'IMPLEMENTED_AND_MAPPED', 'src/engineering-os/executionState.ts', 'execution-continuity-proven'),
    ob('o-yield', 'yield-continuity', 'yield gate (CONTINUE_MACHINE_WORK is not a yield)', 'IMPLEMENTED_AND_MAPPED', 'src/engineering-os/yieldGate.ts', 'yield-continuity-proven'),
    ob('o-owner', 'owner-firewall', 'machine-derived owner firewall', 'IMPLEMENTED_AND_MAPPED', 'src/engineering-os/releaseControlPlane.ts', 'owner-firewall-machine-derived'),
    // ── The honest negative space: obligations that SHOULD exist but do not yet. ──
    ob('o-capability', 'capability-universe', 'static+dynamic capability manifest', 'UNIMPLEMENTED'),
    ob('o-denominator', 'denominator', 'certified acceptance denominator', 'UNIMPLEMENTED'),
    ob('o-claimstate', 'claim-state-model', 'non-collapsible claim-state model', 'UNIMPLEMENTED'),
    ob('o-labcert', 'lab-certification', 'scope-bound lab certification', 'UNIMPLEMENTED'),
    ob('o-producers', 'evidence-producers', 'reproducible evidence producers + lineage', 'UNIMPLEMENTED'),
    ob('o-attest', 'deployment-attestation', 'source→build→deploy attestation', 'UNIMPLEMENTED'),
    ob('o-sw', 'sw-runtime-provenance', 'warm PWA runtime provenance', 'UNIMPLEMENTED'),
    ob('o-privacy', 'privacy-security', 'privacy/security release control', 'UNIMPLEMENTED'),
    ob('o-ci', 'release-ci-enforcement', 'remote release-certification enforcement', 'UNIMPLEMENTED'),
  ]
  const decisionPathComponents = [
    'src/engineering-os/releaseGate.ts',
    'src/engineering-os/releaseControlPlane.ts',
    'src/engineering-os/liveSnapshot.ts',
    'src/engineering-os/controlCompleteness.ts',
    'src/engineering-os/executionState.ts',
  ]
  return { invariants, obligations, decisionPathComponents }
}
