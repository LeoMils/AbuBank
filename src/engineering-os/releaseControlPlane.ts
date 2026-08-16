/*
 * RELEASE CONTROL PLANE — the meta-layer over GATE D (evaluateRelease).
 * ════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS (and what it is NOT):
 *   `src/engineering-os/releaseGate.ts` (GATE D) is a strong, falsifiable
 *   DETERMINISTIC gate: given the present claims/evidence/deploy state it returns
 *   READY/NOT-READY. It is REUSED here verbatim — this module does not fork a
 *   second gate. What GATE D structurally cannot see:
 *     • PASS-by-omission     — a required critical claim that is entirely ABSENT
 *                              from the state (the loop only inspects present items).
 *     • N/A gaming           — a claim silently skipped as "n/a" with no reason.
 *     • severity/risk gaming — a P0 relabeled P2, or a risk-critical area below its
 *                              constitutional floor, with no downgrade proof.
 *     • change-impact gaming — the module/claim resolver narrowing to hide a module.
 *     • owner-firewall        — whether a HUMAN handoff (phone test) is machine-eligible.
 *     • control-plane drift   — evidence certified under a DIFFERENT control plane.
 *     • holdout laundering    — a previously-exposed holdout reused as "independent".
 *     • evaluator disappearance — a required evaluator that CRASHED / never ran
 *                              (distinct from a normal behavioral FAIL).
 *
 * This module adds exactly those invariants as a PURE composable evaluator. It is
 * unit-testable against deliberate seeds (see releaseControlPlane.adversarial.test.ts)
 * — a control plane that cannot itself be falsified is worthless.
 *
 * PRECEDENCE: the machine verdict here is authoritative. Natural-language reporting
 * is DERIVED from it. If prose and this state disagree, this state wins.
 */

import { evaluateRelease, type ReleaseState, type ReleaseBlocker } from './releaseGate'
import { evaluateControlCompleteness, type ControlCompletenessInput } from './controlCompleteness'

// ── Verdicts & non-binary harness states ────────────────────────────────────
// A control-plane verdict is NEVER a bare boolean. Absence, crash, and "not run"
// are first-class and are NOT collapsed into PASS or into a normal FAIL.
//   GO      — every gate clear.
//   NO-GO   — a blocker (base or meta) fired; a normal behavioral rejection.
//   BLOCKED — a required evaluator/source could not produce a valid result;
//             the control plane cannot even be certified for this state.
//   INVALID — the reality judged changed mid-evaluation (Stage-2 time-of-check
//             drift); the verdict describes a state that no longer exists.
export type ControlVerdict = 'GO' | 'NO-GO' | 'BLOCKED' | 'INVALID'

/** Non-binary evaluator/harness outcomes. None of these is certification success. */
export type EvaluatorStatus = 'OK' | 'CRASHED' | 'MISSING' | 'NOT_EXECUTED'

export interface ControlBlocker {
  code: string
  reason: string
  /** Where the evidence for this determination lives (raw ≠ normalized ≠ synthesis). */
  evidence?: string
}

// ── Required-claim reconciliation ────────────────────────────────────────────
export type Severity = 'P0' | 'P1' | 'P2' | 'P3'
export type ClaimApplicability = 'REQUIRED' | 'NOT_APPLICABLE'

/** A claim the change-impact graph says MUST be reconciled before release. */
export interface RequiredClaim {
  id: string
  /** The severity the constitution/impact-graph assigns to this claim's failure. */
  floorSeverity: Severity
  /** True when a P0/P1 on this claim blocks readiness (constitutional). */
  critical: boolean
}

/** A claim actually PRESENT in the release state, with its declared handling. */
export interface PresentClaim {
  id: string
  applicability: ClaimApplicability
  /** Required when applicability === 'NOT_APPLICABLE'. Must be grounded in scope. */
  naReason?: string
  /** The severity the candidate ASSIGNED (may differ from the floor → gaming). */
  assignedSeverity: Severity
  /** Present iff the candidate lowered severity below floor; must justify it. */
  severityDowngradeProof?: string
  status: string // 'PROVEN' | 'UNKNOWN' | 'FAIL' | ...
}

// ── Risk tiers ───────────────────────────────────────────────────────────────
export interface RiskArea {
  area: string
  /** Constitutional minimum tier for this sensitive area (higher = more QA). */
  floorTier: number
  /** The tier the candidate actually applied. */
  appliedTier: number
  /** Required iff appliedTier < floorTier. */
  downgradeProof?: string
}

// ── Change-impact resolver self-check ────────────────────────────────────────
export interface ChangeImpact {
  changedNode: string
  /** Modules the conservative closure KNOWS are affected (oracle/spec-derived). */
  knownRequiredModules: string[]
  /** Modules the resolver actually selected. A subset that drops a known one = gaming. */
  resolvedModules: string[]
}

// ── Owner firewall / parity ──────────────────────────────────────────────────
export type DeadlockClass =
  | 'ENGINEERING_BLOCKER'
  | 'AUTHORITY_BLOCKER'
  | 'PRODUCT_DECISION'
  | 'IRREDUCIBLE_HUMAN_RESIDUAL'

/** Evidence that an automated twin of the requested owner action already PASSED. */
export interface OwnerParity {
  /** The property the owner is being asked to confirm (e.g. "real mic acoustics"). */
  property: string
  /** The candidate SHA this parity evidence was produced against. */
  candidateSha: string
  /** The control-plane identity this parity evidence was produced under. */
  controlPlaneId: string
  /** Automated-twin result for the mechanical part of the property. */
  automatedTwin: EvaluatorStatus
  automatedTwinResult: 'PASS' | 'FAIL' | 'NONE'
  /** Evidence references that must resolve (non-empty, all present). */
  evidenceRefs: string[]
  /** ISO expiry; compared against `now`. */
  expiresAt?: string
  /** The classified residual. Only IRREDUCIBLE_HUMAN_RESIDUAL may reach the owner. */
  residualClass: DeadlockClass
}

export interface OwnerRequest {
  /** Whether a human/owner action (e.g. phone test) is being requested THIS turn. */
  requested: boolean
  parity?: OwnerParity
}

// ── A required evaluator's execution record (Case O) ─────────────────────────
export interface EvaluatorRun {
  name: string
  required: boolean
  status: EvaluatorStatus
}

// ── The full control-plane input ─────────────────────────────────────────────
export interface ControlPlaneInput {
  /** The base GATE D state — evaluated verbatim by evaluateRelease(). */
  release: ReleaseState
  requiredClaims: RequiredClaim[]
  presentClaims: PresentClaim[]
  riskAreas: RiskArea[]
  changeImpact: ChangeImpact[]
  evaluators: EvaluatorRun[]
  /** The candidate under certification. */
  candidateSha: string
  /** The control-plane identity this run is executing under. */
  controlPlaneId: string
  /** The frozen identity, if a freeze exists. Certification requires a match. */
  frozenControlPlaneId?: string
  owner: OwnerRequest
  holdouts?: Holdout[]
  /** ISO timestamp for expiry math (the codebase forbids Date.now() in pure code). */
  now: string
  /**
   * A narrative attempting to force an owner action / READY. The control plane must
   * NOT let prose promote a machine NO-GO. Recorded only to prove it is IGNORED.
   */
  narrativeRequestsOwnerAction?: boolean
  // ── Stage-2 live-adapter inputs (all optional → Stage-1 fixtures unaffected) ──
  /**
   * Health of every release-critical SOURCE the live adapter read. A malformed /
   * missing / wrong-schema / incomplete critical source must BLOCK — it may never
   * silently normalize to an empty array or a passing default (the invariant:
   * less truth can never produce more confidence).
   */
  sources?: SourceHealth[]
  /** Two authoritative sources disagreeing on a release-critical field → block. */
  sourceConflicts?: SourceConflict[]
  /**
   * Authoritative release sources the adapter DISCOVERED but never classified
   * (not consumed / ignored-with-reason / N/A). A high-risk unclassified source
   * blocks confidence in the adapter itself (pass-by-omission one layer up).
   */
  unknownSources?: string[]
  /**
   * Set true by the live CLI when a volatile identity (git HEAD, dirty-state hash,
   * deployed fingerprint, control-plane id) changed between snapshot and re-read.
   * The verdict then describes a reality that no longer exists → INVALID.
   */
  inputDriftDuringEvaluation?: boolean
  /**
   * The control-invariant/component model (§9–12). When present, an unproven
   * release-critical control prerequisite makes the control model INCOMPLETE →
   * release cannot GO. This converts prose-known control gaps into machine state.
   */
  controlCompleteness?: ControlCompletenessInput
}

// ── Stage-2 source health ────────────────────────────────────────────────────
export type SourceParseStatus =
  | 'VALID' | 'MISSING' | 'PARSE_FAILED' | 'SCHEMA_MISMATCH' | 'INCOMPLETE'
export type SourceFreshness = 'FRESH' | 'STALE' | 'UNKNOWN'

export interface SourceHealth {
  name: string
  /** A critical source's defect BLOCKS; a non-critical one is recorded only. */
  critical: boolean
  parseStatus: SourceParseStatus
  /** FRESH iff the source's declared candidate matches the current candidate. */
  freshness?: SourceFreshness
  /** Whether this source is relied on as evidence for a required claim. */
  feedsRequiredEvidence?: boolean
}

export interface SourceConflict {
  field: string
  a: string
  b: string
}

export interface Holdout {
  id: string
  claimsIndependent: boolean
  /** True once its cases were exposed/inspected during debugging → no longer blind. */
  exposed: boolean
}

// ── The machine-readable release state (Section 7) ───────────────────────────
export interface ControlPlaneState {
  candidateSha: string
  controlPlaneId: string
  verdict: ControlVerdict
  /** GATE D blockers, verbatim. */
  releaseBlockers: ReleaseBlocker[]
  /** Meta-layer blockers this module adds. */
  controlBlockers: ControlBlocker[]
  requiredClaimIds: string[]
  presentClaimIds: string[]
  /** Any required evaluator that did not produce a normal result. */
  evaluatorAnomalies: { name: string; status: EvaluatorStatus }[]
  ownerHandoff: OwnerFirewallResult
}

export interface OwnerFirewallResult {
  eligible: boolean
  /** Set when NOT eligible — the exact machine reason a handoff is refused. */
  refusalCode?: string
  reason: string
}

const RANK: Record<Severity, number> = { P0: 3, P1: 2, P2: 1, P3: 0 }

/**
 * The OWNER FIREWALL. Handoff eligibility is MACHINE-DERIVED here — never free-form
 * Claude prose. Returns eligible:true only when every constitutional precondition
 * for asking the owner is met. Convenience is never sufficient.
 */
export function evaluateOwnerFirewall(
  input: ControlPlaneInput,
  baseVerdictIsGo: boolean,
): OwnerFirewallResult {
  const o = input.owner
  // Narrative can never manufacture an owner action while the machine is NO-GO.
  if (input.narrativeRequestsOwnerAction && !baseVerdictIsGo) {
    return { eligible: false, refusalCode: 'NARRATIVE_BYPASS_BLOCKED', reason: 'narrative requested an owner action while the machine verdict is not GO' }
  }
  if (!o.requested) {
    return { eligible: false, reason: 'no owner action requested' }
  }
  // 1. machine verdict must permit handoff.
  if (!baseVerdictIsGo) {
    return { eligible: false, refusalCode: 'MACHINE_VERDICT_NOT_GO', reason: 'machine verdict is not GO; handoff prohibited' }
  }
  const p = o.parity
  // 2. parity evidence must exist.
  if (!p) {
    return { eligible: false, refusalCode: 'OWNER_PARITY_MISSING', reason: 'owner handoff requested with no parity evidence' }
  }
  // 3. candidate identity must match.
  if (p.candidateSha !== input.candidateSha) {
    return { eligible: false, refusalCode: 'OWNER_PARITY_CANDIDATE_MISMATCH', reason: `parity evidence is for candidate ${p.candidateSha}, current is ${input.candidateSha}` }
  }
  // 4. control-plane identity must match.
  if (p.controlPlaneId !== input.controlPlaneId) {
    return { eligible: false, refusalCode: 'OWNER_PARITY_CONTROL_PLANE_MISMATCH', reason: `parity produced under control plane ${p.controlPlaneId}, current is ${input.controlPlaneId}` }
  }
  // 5. parity evidence must not be expired.
  if (p.expiresAt && p.expiresAt < input.now) {
    return { eligible: false, refusalCode: 'OWNER_PARITY_STALE', reason: `parity evidence expired at ${p.expiresAt}` }
  }
  // 6. evidence references must resolve (non-empty, no blanks).
  if (p.evidenceRefs.length === 0 || p.evidenceRefs.some((r) => !r || !r.trim())) {
    return { eligible: false, refusalCode: 'OWNER_PARITY_UNRESOLVED_EVIDENCE', reason: 'parity references stale/blank evidence' }
  }
  // 7. the automated twin must have actually run and PASSED where technically possible.
  if (p.automatedTwin !== 'OK') {
    return { eligible: false, refusalCode: 'OWNER_PARITY_TWIN_NOT_RUN', reason: `automated twin status ${p.automatedTwin}` }
  }
  if (p.automatedTwinResult !== 'PASS') {
    return { eligible: false, refusalCode: 'OWNER_PARITY_TWIN_NOT_PASS', reason: `automated twin result ${p.automatedTwinResult}` }
  }
  // 8. only a genuinely irreducible human residual may reach the owner.
  if (p.residualClass !== 'IRREDUCIBLE_HUMAN_RESIDUAL') {
    return { eligible: false, refusalCode: 'RESIDUAL_NOT_IRREDUCIBLE', reason: `residual classified ${p.residualClass}; repeated engineering difficulty is still engineering` }
  }
  return { eligible: true, reason: `irreducible human residual for "${p.property}" — mechanical proof complete` }
}

/**
 * The control-plane meta-evaluator. Composes GATE D with the meta-invariants and
 * emits the canonical machine-readable state. Fails closed.
 */
export function evaluateControlPlane(input: ControlPlaneInput): ControlPlaneState {
  const releaseResult = evaluateRelease(input.release)
  const controlBlockers: ControlBlocker[] = []
  const add = (code: string, reason: string, evidence?: string) =>
    controlBlockers.push(evidence !== undefined ? { code, reason, evidence } : { code, reason })

  const presentById = new Map(input.presentClaims.map((c) => [c.id, c]))

  // (A) Control-plane drift: certification is invalid if the current control plane
  // differs from the frozen one. (Cases G / M.)
  if (input.frozenControlPlaneId && input.frozenControlPlaneId !== input.controlPlaneId) {
    add('CONTROL_PLANE_MISMATCH', `evidence produced under control plane ${input.controlPlaneId}, frozen is ${input.frozenControlPlaneId}`, 'control-plane-identity.json')
  }

  // (B) Required-claim reconciliation — PASS-by-omission killer. (Case H / I / F.)
  for (const rc of input.requiredClaims) {
    const present = presentById.get(rc.id)
    if (!present) {
      // Missing required claim NEVER disappears silently.
      add('EXPECTED_CLAIM_ABSENT', `required claim '${rc.id}' (${rc.floorSeverity}) is absent from the present claim set`)
      continue
    }
    if (present.applicability === 'NOT_APPLICABLE') {
      // N/A requires a real reason grounded in scope/dependencies.
      if (!present.naReason || !present.naReason.trim()) {
        add('INVALID_NA', `claim '${rc.id}' marked NOT_APPLICABLE without a grounded reason`)
      } else if (rc.critical) {
        // A CRITICAL required claim cannot be silently declared N/A — even with a
        // reason it must be non-critical to skip. A critical claim marked N/A blocks.
        add('INVALID_NA', `critical claim '${rc.id}' marked NOT_APPLICABLE ("${present.naReason}") — a critical required claim cannot be N/A`)
      }
      continue
    }
    // Severity downgrade proof. A P0 relabeled below its floor needs proof. (Case F.)
    if (RANK[present.assignedSeverity] < RANK[rc.floorSeverity] && !present.severityDowngradeProof) {
      add('SEVERITY_DOWNGRADE_UNPROVEN', `claim '${rc.id}' assigned ${present.assignedSeverity} but floor is ${rc.floorSeverity} — no downgrade proof`)
    }
    // Critical UNKNOWN is never PASS.
    if (rc.critical && /unknown/i.test(present.status)) {
      add('CRITICAL_UNKNOWN', `critical claim '${rc.id}' is UNKNOWN`)
    }
  }

  // (C) Risk-tier floors. (Case J.)
  for (const r of input.riskAreas) {
    if (r.appliedTier < r.floorTier && !r.downgradeProof) {
      add('RISK_FLOOR_VIOLATION', `${r.area} applied tier ${r.appliedTier} < floor ${r.floorTier} with no RISK_DOWNGRADE_PROOF`)
    }
  }

  // (D) Change-impact resolver self-check. (Case K.)
  for (const ci of input.changeImpact) {
    const resolved = new Set(ci.resolvedModules)
    const omitted = ci.knownRequiredModules.filter((m) => !resolved.has(m))
    if (omitted.length > 0) {
      add('CHANGE_IMPACT_MODULE_OMITTED', `change to ${ci.changedNode} omits required module(s): ${omitted.join(', ')}`)
    }
  }

  // (E) Holdout independence. (Case N.)
  for (const h of input.holdouts ?? []) {
    if (h.claimsIndependent && h.exposed) {
      add('HOLDOUT_NOT_INDEPENDENT', `holdout '${h.id}' was exposed/inspected and cannot be reused as independent holdout`)
    }
  }

  // (F) Evaluator disappearance — non-binary. A required evaluator that CRASHED /
  // is MISSING / NOT_EXECUTED blocks the control plane (distinct from a FAIL). (Case O.)
  const evaluatorAnomalies = input.evaluators
    .filter((e) => e.required && e.status !== 'OK')
    .map((e) => ({ name: e.name, status: e.status }))
  for (const a of evaluatorAnomalies) {
    const code = a.status === 'CRASHED' ? 'EVALUATOR_CRASHED'
      : a.status === 'MISSING' ? 'EVIDENCE_MISSING'
      : 'NOT_EXECUTED'
    add(code, `required evaluator '${a.name}' status ${a.status}`)
  }

  // (G) STAGE-2 SOURCE HEALTH. A release-critical source that could not be read/parsed
  // is NOT an empty array — it means the control plane cannot be certified for this
  // state (BLOCKED). A stale-but-parseable source is a normal blocker (NO-GO).
  let cannotCertify = false
  for (const s of input.sources ?? []) {
    if (!s.critical) continue
    switch (s.parseStatus) {
      case 'MISSING': add('SOURCE_MISSING', `critical source '${s.name}' is MISSING`); cannotCertify = true; break
      case 'PARSE_FAILED': add('SOURCE_PARSE_FAILED', `critical source '${s.name}' failed to parse`); cannotCertify = true; break
      case 'SCHEMA_MISMATCH': add('SCHEMA_VERSION_MISMATCH', `critical source '${s.name}' has an unsupported schema version`); cannotCertify = true; break
      case 'INCOMPLETE': add('SOURCE_INCOMPLETE', `critical source '${s.name}' is missing required fields`); cannotCertify = true; break
      case 'VALID': break
    }
    // Stale evidence for THIS candidate cannot satisfy a gate (constitutional).
    if (s.parseStatus === 'VALID' && s.feedsRequiredEvidence && s.freshness === 'STALE') {
      add('EVIDENCE_STALE', `source '${s.name}' is stale for the current candidate — cannot satisfy a required-evidence gate`)
    }
  }
  // (H) Two authoritative sources disagreeing on a release-critical field → cannot trust.
  for (const c of input.sourceConflicts ?? []) {
    add('SOURCE_CONFLICT', `sources disagree on '${c.field}': ${c.a} vs ${c.b}`)
    cannotCertify = true
  }
  // (H2) An unclassified authoritative source could feed release truth invisibly.
  for (const u of input.unknownSources ?? []) {
    add('SOURCE_COVERAGE_UNKNOWN', `authoritative source '${u}' is neither consumed nor classified — the adapter cannot be trusted complete`)
    cannotCertify = true
  }

  // (I2) CONTROL COMPLETENESS (§9–12). An uncovered/orphan/undeclared/invalidated
  // control component, or any unproven release-critical control prerequisite, means
  // the release TRUST is incomplete — the control plane cannot certify GO.
  if (input.controlCompleteness) {
    const cc = evaluateControlCompleteness(input.controlCompleteness)
    for (const bl of cc.blockers) { add(bl.code, bl.reason); cannotCertify = true }
  }

  // (I) Time-of-check drift — the reality judged no longer exists.
  if (input.inputDriftDuringEvaluation) {
    add('INPUT_DRIFT_DURING_EVALUATION', 'a volatile identity changed between snapshot and re-read; verdict is INVALID')
  }

  // ── Compose the verdict. Fail closed. ──────────────────────────────────────
  const hasEvaluatorAnomaly = evaluatorAnomalies.length > 0
  const anyBlocker = releaseResult.blockers.length > 0 || controlBlockers.length > 0
  // Precedence: a reality that changed mid-evaluation voids the whole verdict.
  // Then anything that makes the state UNCERTIFIABLE (evaluator gone, critical source
  // unreadable, contradiction) is BLOCKED. A normal blocker is NO-GO.
  const verdict: ControlVerdict = input.inputDriftDuringEvaluation
    ? 'INVALID'
    : (hasEvaluatorAnomaly || cannotCertify)
      ? 'BLOCKED'
      : anyBlocker ? 'NO-GO' : 'GO'

  const baseVerdictIsGo = verdict === 'GO'
  const ownerHandoff = evaluateOwnerFirewall(input, baseVerdictIsGo)

  return {
    candidateSha: input.candidateSha,
    controlPlaneId: input.controlPlaneId,
    verdict,
    releaseBlockers: releaseResult.blockers,
    controlBlockers,
    requiredClaimIds: input.requiredClaims.map((c) => c.id),
    presentClaimIds: input.presentClaims.map((c) => c.id),
    evaluatorAnomalies,
    ownerHandoff,
  }
}

/**
 * CONTROL_PLANE_IDENTITY — a stable, order-independent digest of the release-critical
 * component hashes. Evidence produced under one identity may not silently certify
 * another. Pure (hashes are injected); the CLI computes real file hashes.
 */
export function computeControlPlaneIdentity(components: Record<string, string>): string {
  const parts = Object.keys(components).sort().map((k) => `${k}:${components[k]}`)
  // Small deterministic FNV-1a over the joined component list. Not cryptographic —
  // its only job is to CHANGE when any release-critical component changes.
  let h = 0x811c9dc5
  const s = parts.join('|')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return 'cp_' + h.toString(16).padStart(8, '0')
}
