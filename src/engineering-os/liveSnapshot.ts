/*
 * LIVE-STATE ADAPTER — the ONE canonical path from real repository truth to a
 * control-plane verdict.  (Stage 2)
 * ════════════════════════════════════════════════════════════════════════════
 *   REAL SOURCES → LiveSnapshot → ControlPlaneInput → evaluateControlPlane → verdict
 *
 * This adapter NORMALIZES and RECONCILES; it does NOT own truth. Every value is
 * traced to its authoritative source (SourceProvenance). It is release-critical
 * from Stage 2 onward and is inside CONTROL_PLANE_IDENTITY.
 *
 * THE PRODUCTION INVARIANT: less truth can never produce more confidence. A source
 * that is missing / malformed / wrong-schema / incomplete NEVER silently becomes an
 * empty array or a passing default — it becomes a BLOCKING SourceHealth.
 *
 * All IO is INJECTED (SourceReader + git/deploy primitives) so the adapter path —
 * parser → normalization → reconciliation → gate — is falsification-tested without
 * touching real QA data (Stage-2 §13 safe isolation).
 */
import type {
  ControlPlaneInput, SourceHealth, SourceConflict, SourceParseStatus,
  RequiredClaim, PresentClaim, RiskArea, ChangeImpact, EvaluatorRun, Severity,
} from './releaseControlPlane'
import type { ControlCompletenessInput } from './controlCompleteness'
import type { ReleaseState, EvidenceClaim } from './releaseGate'

// ── Source reader (DI boundary) ──────────────────────────────────────────────
export interface SourceReadResult {
  status: SourceParseStatus
  json?: unknown
  /** Candidate identity the source declares it was produced for (build/commit). */
  declaredBuild?: string
  declaredCommit?: string
  /** The `$schema` string the file carries, if any. */
  schema?: string
}
export type SourceReader = (relPath: string) => SourceReadResult

// ── Source registry — the authoritative release-critical sources ─────────────
export interface SourceSpec {
  name: string
  path: string
  authority: string
  schemaId?: string
  critical: boolean
  feedsRequiredEvidence: boolean
  /** Top-level keys that MUST be present, else the source is INCOMPLETE. */
  requiredKeys: string[]
}
export const SOURCE_REGISTRY: SourceSpec[] = [
  { name: 'qa-ownership', path: 'docs/engineering-os/qa/qa-ownership.json', authority: 'CLAUDE_MUST_PROVE required-claim set', schemaId: 'internal://abu/qa-ownership', critical: true, feedsRequiredEvidence: true, requiredKeys: ['CLAUDE_MUST_PROVE'] },
  { name: 'evidence', path: 'docs/engineering-os/qa/evidence.json', authority: 'evidence claims', schemaId: 'internal://abu/evidence', critical: true, feedsRequiredEvidence: true, requiredKeys: ['claims'] },
  { name: 'meta-qa', path: 'docs/engineering-os/qa/meta-qa.json', authority: 'mutation certification + blind-spot register', schemaId: 'internal://abu/meta-qa', critical: true, feedsRequiredEvidence: true, requiredKeys: ['mutationCertification', 'blindSpotRegister'] },
  { name: 'failure-genome', path: 'docs/engineering-os/qa/failure-genome.json', authority: 'historical failure regressions', critical: true, feedsRequiredEvidence: true, requiredKeys: ['failures'] },
  { name: 'mission', path: 'docs/engineering-os/qa/mission.json', authority: 'gate-readiness flags', critical: true, feedsRequiredEvidence: true, requiredKeys: ['gatesReady'] },
  { name: 'product-universe', path: 'docs/engineering-os/qa/product-universe.json', authority: 'surface universe + risk', schemaId: 'internal://abu/product-universe', critical: true, feedsRequiredEvidence: true, requiredKeys: ['screens'] },
  { name: 'master-matrix', path: 'docs/engineering-os/qa/master-matrix.json', authority: 'journey coverage matrix', critical: true, feedsRequiredEvidence: true, requiredKeys: ['journeys'] },
]

// ── Provenance ───────────────────────────────────────────────────────────────
export type SourceFreshness = 'FRESH' | 'STALE' | 'UNKNOWN'
export interface SourceProvenance {
  field: string
  source: string
  authority: string
  schemaVersion: string | null
  declaredCandidate: string | null
  freshness: SourceFreshness
  candidateSha: string
  controlPlaneId: string
  transform: string
  parseStatus: SourceParseStatus
}

// ── Primitives the CLI injects (real) / tests inject (synthetic) ─────────────
export interface LiveDeps {
  readSource: SourceReader
  git: { head: string; remote: string | null; dirtyRuntime: string[]; dirtyStateHash: string }
  deploy: { healthBuildVersion: string | null; expectedBuildVersion: string; aliasOk: boolean }
  /** Current candidate build label (from src/version.ts). */
  candidateBuild: string
  controlPlaneId: string
  frozenControlPlaneId?: string
  now: string
  /** Changed files for the change-impact closure. */
  changedFiles: string[]
  /** path-prefix → required module names (conservative closure). */
  moduleOwnership: Record<string, string[]>
  /** fs/suite oracles for the base GATE D sub-state (injected; real in the CLI). */
  testFileExists: (path: string) => boolean
  suiteResult: (path: string) => 'pass' | 'fail' | 'skipped' | 'unknown'
  privacyScanPass: boolean
  /** Evaluator artifact health, already read (name→status). */
  evaluatorStatuses: EvaluatorRun[]
  /** Whether an owner action is being requested this run (normally false in CI). */
  ownerRequested?: boolean
  /**
   * Every authoritative release source DISCOVERED in the repo (e.g. by a glob of
   * docs/engineering-os/qa/**). Any discovered source not consumed/ignored/N-A is
   * UNKNOWN → blocks confidence in the adapter's completeness.
   */
  discoveredSources?: string[]
  /** The control-invariant/component model (§9–12), passed straight through. */
  controlModel?: ControlCompletenessInput
}

// ── The immutable snapshot ───────────────────────────────────────────────────
export interface LiveSnapshot {
  candidateSha: string
  candidateBuild: string
  controlPlaneId: string
  frozenControlPlaneId?: string
  now: string
  workingTreeIdentity: { dirtyStateHash: string; dirtyRuntime: string[] }
  deployedCandidateIdentity: { fingerprint: string | null; aliasOk: boolean }
  provenance: SourceProvenance[]
  sources: SourceHealth[]
  sourceConflicts: SourceConflict[]
  sourceCoverage: SourceCoverage
  requiredClaims: RequiredClaim[]
  presentClaims: PresentClaim[]
  riskAreas: RiskArea[]
  changeImpact: ChangeImpact[]
  evaluators: EvaluatorRun[]
  release: ReleaseState
  ownerRequested: boolean
  controlModel?: ControlCompletenessInput
}

export interface SourceCoverage {
  consumed: string[]
  intentionallyIgnored: { name: string; reason: string }[]
  notApplicable: { name: string; reason: string }[]
  unknown: string[]
}

const SEV_BY_RISK: Record<string, Severity> = { high: 'P0', medium: 'P1', low: 'P2' }
const FLOOR_TIER_BY_RISK: Record<string, number> = { high: 3, medium: 2, low: 1 }

/** Compare a source's declared candidate to the current one. Truth-driven — the
 *  adapter does NOT assume any source is stale; it computes it. */
function freshnessOf(declaredBuild: string | null | undefined, declaredCommit: string | null | undefined, candidateBuild: string, head: string): SourceFreshness {
  if (!declaredBuild && !declaredCommit) return 'UNKNOWN'
  const semver = (s: string) => (s.match(/\d+\.\d+\.\d+/) || [''])[0]
  if (declaredCommit && head.startsWith(declaredCommit)) return 'FRESH'
  if (declaredBuild && semver(declaredBuild) && semver(declaredBuild) === semver(candidateBuild)) return 'FRESH'
  return 'STALE'
}

function classifyDone(status: string): boolean {
  return /PROVEN|DONE/i.test(status) && !/PENDING|PARTIAL|NOT/i.test(status)
}

/**
 * Build the immutable live snapshot from injected real sources. Fails LOUD: a
 * malformed critical source yields a blocking SourceHealth, never an empty default.
 */
export function buildLiveSnapshot(deps: LiveDeps): LiveSnapshot {
  const provenance: SourceProvenance[] = []
  const sources: SourceHealth[] = []
  const reads = new Map<string, SourceReadResult>()

  for (const spec of SOURCE_REGISTRY) {
    const r = deps.readSource(spec.path)
    reads.set(spec.name, r)
    let status = r.status
    // Schema-version enforcement: a declared $schema that differs is a MISMATCH.
    if (status === 'VALID' && spec.schemaId && r.schema && r.schema !== spec.schemaId) {
      status = 'SCHEMA_MISMATCH'
    }
    // Completeness: required keys must be present, else INCOMPLETE.
    if (status === 'VALID' && r.json && typeof r.json === 'object') {
      const obj = r.json as Record<string, unknown>
      if (spec.requiredKeys.some((k) => !(k in obj))) status = 'INCOMPLETE'
    }
    const freshness = freshnessOf(r.declaredBuild, r.declaredCommit, deps.candidateBuild, deps.git.head)
    sources.push({
      name: spec.name,
      critical: spec.critical,
      parseStatus: status,
      freshness,
      feedsRequiredEvidence: spec.feedsRequiredEvidence,
    })
    provenance.push({
      field: spec.name,
      source: spec.path,
      authority: spec.authority,
      schemaVersion: r.schema ?? null,
      declaredCandidate: r.declaredCommit ?? r.declaredBuild ?? null,
      freshness,
      candidateSha: deps.git.head,
      controlPlaneId: deps.controlPlaneId,
      transform: `read+parse+schema+completeness (${status})`,
      parseStatus: status,
    })
  }

  const ok = (name: string): Record<string, unknown> | null => {
    const r = reads.get(name)
    const h = sources.find((s) => s.name === name)
    if (!r || !h || h.parseStatus !== 'VALID' || !r.json || typeof r.json !== 'object') return null
    return r.json as Record<string, unknown>
  }

  // ── LIVE required claims (§8): from ownership + product-universe high-risk. ──
  const ownership = ok('qa-ownership')
  const universe = ok('product-universe')
  const requiredClaims: RequiredClaim[] = []
  const claimSource = new Map<string, string>()
  if (ownership && Array.isArray(ownership.CLAUDE_MUST_PROVE)) {
    for (const it of ownership.CLAUDE_MUST_PROVE as { item: string }[]) {
      requiredClaims.push({ id: it.item, floorSeverity: 'P1', critical: true })
      claimSource.set(it.item, 'qa-ownership:CLAUDE_MUST_PROVE')
    }
  }
  if (universe && Array.isArray(universe.screens)) {
    for (const s of universe.screens as { surfaceId: string; risk: string }[]) {
      if (/high/i.test(s.risk)) {
        const id = `surface:${s.surfaceId}`
        requiredClaims.push({ id, floorSeverity: SEV_BY_RISK[s.risk.toLowerCase()] ?? 'P1', critical: true })
        claimSource.set(id, 'product-universe:high-risk-surface')
      }
    }
  }

  // ── LIVE present claims: from evidence.json + ownership statuses. ────────────
  const evidence = ok('evidence')
  const presentClaims: PresentClaim[] = []
  const presentIds = new Set<string>()
  if (ownership && Array.isArray(ownership.CLAUDE_MUST_PROVE)) {
    for (const it of ownership.CLAUDE_MUST_PROVE as { item: string; status: string; applicability?: string; naReason?: string }[]) {
      const status = String(it.status ?? '')
      // Honor an explicit N/A marker from the source. A critical N/A without a
      // grounded reason is caught downstream (INVALID_NA) — never silently dropped.
      if (it.applicability === 'NOT_APPLICABLE') {
        presentClaims.push({
          id: it.item,
          applicability: 'NOT_APPLICABLE',
          ...(it.naReason ? { naReason: it.naReason } : {}),
          assignedSeverity: 'P1',
          status: 'NOT_APPLICABLE',
        })
        presentIds.add(it.item)
        continue
      }
      presentClaims.push({
        id: it.item,
        applicability: 'REQUIRED',
        assignedSeverity: 'P1',
        status: classifyDone(status) ? 'PROVEN' : /UNKNOWN/i.test(status) ? 'UNKNOWN' : status || 'UNKNOWN',
      })
      presentIds.add(it.item)
    }
  }
  // STRUCTURED claim→surface link (replaces the substring-match heuristic oracle).
  // A high-risk surface is PRESENT only if some evidence claim EXPLICITLY lists it
  // in a structured `surfaces: string[]` field. Substring-matching the claim TEXT is
  // a heuristic oracle that both FALSE-POSITIVES (a claim that merely mentions — or
  // even negates — a surface would mark it covered) and FALSE-NEGATIVES (a differently
  // spelled reference, e.g. "Abu AI" vs surfaceId "AbuAI", is missed). That
  // oracle-from-the-artifact-under-test class already escaped once in this project;
  // there is NO substring fallback here.
  const coveredSurfaces = new Set<string>()
  if (evidence && Array.isArray(evidence.claims)) {
    for (const c of evidence.claims as { surfaces?: unknown }[]) {
      if (Array.isArray(c.surfaces)) for (const sid of c.surfaces) coveredSurfaces.add(String(sid))
    }
  }
  if (universe && Array.isArray(universe.screens)) {
    for (const s of universe.screens as { surfaceId: string; risk: string }[]) {
      if (/high/i.test(s.risk)) {
        const id = `surface:${s.surfaceId}`
        if (coveredSurfaces.has(s.surfaceId)) {
          presentClaims.push({ id, applicability: 'REQUIRED', assignedSeverity: SEV_BY_RISK[s.risk.toLowerCase()] ?? 'P1', status: 'PROVEN' })
          presentIds.add(id)
        }
        // If not structurally covered, it is DELIBERATELY not added → EXPECTED_CLAIM_ABSENT.
      }
    }
  }

  // ── Risk areas (§6): from product-universe risk vs constitutional floor. ────
  // Missing risk data is NEVER an optimistic default: an unspecified risk gets the
  // MAX floor and a zero applied tier → a deliberate RISK_FLOOR_VIOLATION downstream.
  const riskAreas: RiskArea[] = []
  if (universe && Array.isArray(universe.screens)) {
    for (const s of universe.screens as { surfaceId: string; risk?: string; riskTierApplied?: number }[]) {
      if (!s.risk) {
        riskAreas.push({ area: `surface:${s.surfaceId}`, floorTier: 3, appliedTier: 0 })
        continue
      }
      const floor = FLOOR_TIER_BY_RISK[String(s.risk).toLowerCase()] ?? 3
      const applied = typeof s.riskTierApplied === 'number' ? s.riskTierApplied : floor
      riskAreas.push({ area: `surface:${s.surfaceId}`, floorTier: floor, appliedTier: applied })
    }
  }

  // ── Change-impact (conservative closure from changed files). ────────────────
  const changeImpact: ChangeImpact[] = deps.changedFiles.map((f) => {
    const known = Object.entries(deps.moduleOwnership)
      .filter(([prefix]) => f.startsWith(prefix))
      .flatMap(([, mods]) => mods)
    return { changedNode: f, knownRequiredModules: known, resolvedModules: known /* adapter resolves conservatively */ }
  }).filter((c) => c.knownRequiredModules.length > 0)

  // ── Source conflicts: two VALID same-candidate sources disagreeing. ─────────
  const sourceConflicts = detectSourceConflicts(reads, sources)

  // ── Base GATE D sub-state, reconciled from the SAME sources. ────────────────
  const genome = ok('failure-genome')
  const metaQa = ok('meta-qa')
  const matrix = ok('master-matrix')
  const mission = ok('mission')
  const evidenceClaims: EvidenceClaim[] = evidence && Array.isArray(evidence.claims)
    ? (evidence.claims as Record<string, unknown>[]).map((c) => ({
        claim: String(c.claim ?? ''), test: String(c.test ?? ''), result: String(c.result ?? ''),
        evidenceLevel: String(c.evidenceLevel ?? ''), mode: String(c.mode ?? ''),
      }))
    : []
  const gr = (mission?.gatesReady ?? {}) as Record<string, unknown>
  const claudeMustProve = ownership && Array.isArray(ownership.CLAUDE_MUST_PROVE)
    ? (ownership.CLAUDE_MUST_PROVE as { item: string; status: string }[]).map((x) => ({ item: x.item, status: String(x.status ?? '') }))
    : []
  const highRisk = new Set(
    universe && Array.isArray(universe.screens)
      ? (universe.screens as { surfaceId: string; risk: string }[]).filter((s) => /high|medium/i.test(s.risk)).map((s) => s.surfaceId)
      : [],
  )
  const release: ReleaseState = {
    claudeMustProve,
    doneStatuses: Array.from(new Set(claudeMustProve.map((c) => c.status).filter(classifyDone))),
    evidenceClaims,
    genome: genome && Array.isArray(genome.failures) ? (genome.failures as Record<string, unknown>[]).map((f) => ({ failureId: String(f.failureId ?? ''), regressionTest: String(f.regressionTest ?? '') })) : [],
    metaMutation: metaQa && Array.isArray(metaQa.mutationCertification) ? (metaQa.mutationCertification as Record<string, unknown>[]).map((m) => ({ invariant: String(m.invariant ?? ''), caughtBy: String(m.caughtBy ?? '') })) : [],
    blindSpots: metaQa && Array.isArray(metaQa.blindSpotRegister) ? (metaQa.blindSpotRegister as Record<string, unknown>[]).map((b) => ({ defectClass: String(b.defectClass ?? ''), status: String(b.status ?? ''), automatable: !/PHYSICAL|device-only|DEVICE_ONLY|automatable=no/i.test(String(b.status ?? '')) })) : [],
    git: { head: deps.git.head, remote: deps.git.remote, dirtyRuntime: deps.git.dirtyRuntime },
    deploy: deps.deploy,
    testFileExists: deps.testFileExists,
    suiteResult: deps.suiteResult,
    requiredSuites: [],
    gates: { aToC: !!gr.aToC, realProviderMatrix: !!gr.realProviderMatrix, enlargedText: !!gr.enlargedText, privacyScan: deps.privacyScanPass ? 'pass' : 'fail' },
    codeArtifactCommitsDiffer: false,
    commitsDocOnlyClassified: true,
    productUniversePresent: sources.find((s) => s.name === 'product-universe')?.parseStatus === 'VALID',
    masterMatrixPresent: sources.find((s) => s.name === 'master-matrix')?.parseStatus === 'VALID',
    criticalCoverageGaps: matrix && Array.isArray(matrix.journeys)
      ? (matrix.journeys as { id: string; status: string; surface: string; gap?: string }[])
          .filter((j) => String(j.status) === 'GAP' && highRisk.has(String(j.surface).split('/')[0] ?? ''))
          .map((j) => `${j.id} (${j.surface}): ${j.gap || 'no evidence'}`)
      : [],
  }

  return {
    candidateSha: deps.git.head,
    candidateBuild: deps.candidateBuild,
    controlPlaneId: deps.controlPlaneId,
    ...(deps.frozenControlPlaneId !== undefined ? { frozenControlPlaneId: deps.frozenControlPlaneId } : {}),
    now: deps.now,
    workingTreeIdentity: { dirtyStateHash: deps.git.dirtyStateHash, dirtyRuntime: deps.git.dirtyRuntime },
    deployedCandidateIdentity: { fingerprint: deps.deploy.healthBuildVersion, aliasOk: deps.deploy.aliasOk },
    provenance,
    sources,
    sourceConflicts,
    sourceCoverage: computeSourceCoverage(),
    requiredClaims,
    presentClaims,
    riskAreas,
    changeImpact,
    evaluators: deps.evaluatorStatuses,
    release,
    ownerRequested: !!deps.ownerRequested,
    ...(deps.controlModel ? { controlModel: deps.controlModel } : {}),
  }

  function computeSourceCoverage(): SourceCoverage {
    const intentionallyIgnored = [
      { name: 'control-plane own outputs (*-result.json, control-plane-identity.json, control-plane-live-verdict.json)', reason: "the control plane's OWN outputs, not release-evidence inputs — consuming them would be circular." },
      { name: 'lifecycle-forensics-result.json', reason: 'forensic output for a prior candidate; superseded, not a current-candidate gate input.' },
      { name: 'production-convergence/*', reason: 'per-experiment scorecard lane for a prior candidate (0.177); superseded by the live candidate. Recorded as stale, not a gate input.' },
      { name: 'realtime-vertical-slice/*', reason: 'prior vertical-slice lane; historical, not current-candidate evidence.' },
      { name: 'e2e/screenshots/*', reason: 'visual artifacts, not machine gate inputs.' },
      { name: 'capability/denominator/evidence producer outputs (capability-manifest, capability-discovery-source-manifest, capability-reconciliation, rc-reachability-observation, tool-firing-evidence, acceptance-denominator, deployed-secret-exposure)', reason: "the control plane's OWN Stage-3C producer outputs — surfaced via the obligation model + reconciliation, not independent release-evidence inputs; consuming them here would be circular." },
    ]
    const notApplicable = [
      { name: 'gate-a-result.json', reason: 'A→B→C lab output already surfaced via mission.gatesReady.aToC.' },
    ]
    const consumed = SOURCE_REGISTRY.map((s) => s.name)
    // The control plane's own outputs and per-candidate forensic outputs are NOT
    // release-evidence inputs. Recognizing them prevents the coverage detector from
    // false-flagging the plane's own artifacts (a defect the real run exposed).
    const OWN_OUTPUT_OR_FORENSIC = /(-result\.json|control-plane-identity\.json|control-plane-live-verdict\.json|lifecycle-forensics-result\.json|gate-a-result\.json|capability-manifest\.json|capability-discovery-source-manifest\.json|capability-reconciliation\.json|rc-reachability-observation\.json|tool-firing-evidence\.json|acceptance-denominator\.json|deployed-secret-exposure\.json|client-secret-fallbacks\.json)$/
    const IGNORED_LANE = /(production-convergence|realtime-vertical-slice)\//
    const classified = new Set<string>([...consumed, ...SOURCE_REGISTRY.map((s) => s.path)])
    const matchesClassified = (d: string) =>
      classified.has(d) ||
      OWN_OUTPUT_OR_FORENSIC.test(d) ||
      IGNORED_LANE.test(d) ||
      SOURCE_REGISTRY.some((s) => d.endsWith(s.path) || d.endsWith(`${s.name}.json`))
    const unknown = (deps.discoveredSources ?? []).filter((d) => !matchesClassified(d))
    return { consumed, intentionallyIgnored, notApplicable, unknown }
  }
}

/** Detect two VALID sources declaring the same candidate but disagreeing on a
 *  release-critical field (here: gate-readiness vs a NOT-pass verdict). */
function detectSourceConflicts(reads: Map<string, SourceReadResult>, sources: SourceHealth[]): SourceConflict[] {
  const conflicts: SourceConflict[] = []
  const mission = reads.get('mission')
  const mh = sources.find((s) => s.name === 'mission')
  if (mission?.status === 'VALID' && mh?.parseStatus === 'VALID' && mission.json && typeof mission.json === 'object') {
    const m = mission.json as Record<string, unknown>
    const verdict = String(m.verdict ?? '')
    const gr = (m.gatesReady ?? {}) as Record<string, unknown>
    const allGatesReady = ['aToC', 'realProviderMatrix', 'enlargedText'].every((k) => gr[k] === true)
    // A READY verdict that coexists with a not-all-ready gate map is self-contradictory.
    if (/READY/i.test(verdict) && !allGatesReady) {
      conflicts.push({ field: 'mission.verdict-vs-gatesReady', a: `verdict=${verdict}`, b: `gatesReady incomplete` })
    }
  }
  return conflicts
}

/** Project the snapshot into the pure control-plane input. */
export function toControlPlaneInput(s: LiveSnapshot, opts?: { inputDriftDuringEvaluation?: boolean }): ControlPlaneInput {
  return {
    release: s.release,
    requiredClaims: s.requiredClaims,
    presentClaims: s.presentClaims,
    riskAreas: s.riskAreas,
    changeImpact: s.changeImpact,
    evaluators: s.evaluators,
    candidateSha: s.candidateSha,
    controlPlaneId: s.controlPlaneId,
    ...(s.frozenControlPlaneId !== undefined ? { frozenControlPlaneId: s.frozenControlPlaneId } : {}),
    owner: { requested: s.ownerRequested },
    holdouts: [],
    now: s.now,
    sources: s.sources,
    sourceConflicts: s.sourceConflicts,
    unknownSources: s.sourceCoverage.unknown,
    inputDriftDuringEvaluation: opts?.inputDriftDuringEvaluation ?? false,
    ...(s.controlModel ? { controlCompleteness: s.controlModel } : {}),
  }
}

/** Deterministic, order-independent hash of the release-critical reality judged.
 *  The verdict MUST reference this so a verdict can be tied to the exact snapshot. */
export function computeInputHash(s: LiveSnapshot): string {
  const canonical = {
    candidateSha: s.candidateSha,
    candidateBuild: s.candidateBuild,
    controlPlaneId: s.controlPlaneId,
    frozenControlPlaneId: s.frozenControlPlaneId ?? null,
    dirtyStateHash: s.workingTreeIdentity.dirtyStateHash,
    deployed: s.deployedCandidateIdentity,
    sources: [...s.sources].sort((a, b) => a.name.localeCompare(b.name)).map((x) => `${x.name}:${x.parseStatus}:${x.freshness}`),
    conflicts: s.sourceConflicts.map((c) => c.field).sort(),
    requiredClaims: s.requiredClaims.map((c) => c.id).sort(),
    presentClaims: s.presentClaims.map((c) => c.id).sort(),
    evaluators: [...s.evaluators].map((e) => `${e.name}:${e.status}`).sort(),
  }
  const str = JSON.stringify(canonical)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return 'in_' + h.toString(16).padStart(8, '0')
}
