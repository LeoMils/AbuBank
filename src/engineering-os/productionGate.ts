/*
 * ABU AI — DETERMINISTIC PRODUCTION GATE (pure evaluator).
 * ══════════════════════════════════════════════════════════════════════════
 * The single machine-enforced answer to "is the AUTOMATABLE Production Candidate
 * complete?". It is PURE (no fs / no git / no time) so it is unit-testable and
 * cannot be gamed by environment. The CLI wrapper (scripts/qa-production-gate.ts)
 * supplies the parsed scorecard + the real git commit; this module decides.
 *
 * A row can only be GREEN from DERIVED evidence: a status of PROVEN plus a
 * currentEvidenceClass at least as strong as the row's required minEvidenceClass,
 * plus at least one test/evidence artifact, plus a build fingerprint that matches
 * the candidate. Free-text alone never passes an automatable Critical/High row.
 *
 * The gate FAILS (nonzero) while ANY automatable Critical/High row is open, has
 * an evidence deficit, is stale, is mis-classified, or carries a fake
 * physical/external blocker. See productionGate.test.ts for the adversarial
 * false-green fixtures that prove it rejects gamed evidence.
 */

export const EVIDENCE_LADDER = [
  'STATIC', 'UNIT', 'INTEGRATION', 'PRODUCTION_ADAPTER', 'BROWSER',
  'DEPLOYED_PREVIEW', 'LIVE_PROVIDER', 'PHYSICAL_DEVICE', 'PRODUCTION',
] as const
export type EvidenceClass = typeof EVIDENCE_LADDER[number]

export const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const
export type Severity = typeof SEVERITIES[number]

export const CLASSIFICATIONS = ['automatable', 'physical', 'external'] as const
export type Classification = typeof CLASSIFICATIONS[number]

export const STATUSES = [
  'PROVEN', 'PARTIAL', 'GAP', 'TESTED_NOT_DEPLOYED', 'STALE',
  'EXTERNAL_BLOCKER', 'PHYSICAL_ONLY',
] as const
export type RowStatus = typeof STATUSES[number]

export interface Fingerprint { commit: string; build: string }

export interface ScorecardRow {
  id: string
  surface: string
  severity: Severity
  classification: Classification
  owner: string
  oracle: string
  minEvidenceClass: EvidenceClass
  currentEvidenceClass: EvidenceClass
  tests: string[]
  evidenceArtifact: string
  fingerprint: Fingerprint
  rollbackTrigger: string
  status: RowStatus
  /** REQUIRED when status is EXTERNAL_BLOCKER or PHYSICAL_ONLY — concrete proof of the blocker. */
  blockerProof?: string
}

export interface Scorecard {
  schemaVersion: number
  evidenceLadder: readonly string[]
  fingerprint: Fingerprint
  rows: ScorecardRow[]
}

export interface GateOptions {
  /** The real HEAD commit; when provided, the scorecard fingerprint must match it. */
  actualCommit?: string
  /** Skip git-commit staleness (used by --fast / the Stop guard). */
  fast?: boolean
  /** Repo-relative existence checker (CLI wires fs). Enables MISSING_TEST_FILE /
   *  MISSING_EVIDENCE_ARTIFACT — a PROVEN row cannot cite deleted/nonexistent evidence. */
  fileExists?: (repoRelativePath: string) => boolean
  /** Required Critical/High inventory ids that MUST each appear as a scorecard row —
   *  deleting or omitting a required row cannot produce a false PASS. */
  requiredInventoryIds?: string[]
}

export interface GateReason { id: string; code: string; detail: string }

export interface GateResult {
  pass: boolean
  commit: string
  build: string
  totalsBySeverity: Record<string, number>
  automatableCriticalHighTotal: number
  automatableCriticalHighOpen: number
  physicalCount: number
  externalCount: number
  reasons: GateReason[]
}

const REQUIRED_FIELDS: (keyof ScorecardRow)[] = [
  'id', 'surface', 'severity', 'classification', 'owner', 'oracle',
  'minEvidenceClass', 'currentEvidenceClass', 'tests', 'evidenceArtifact',
  'fingerprint', 'rollbackTrigger', 'status',
]

function ladderIndex(c: string): number { return EVIDENCE_LADDER.indexOf(c as EvidenceClass) }
function isCriticalHigh(sev: string): boolean { return sev === 'Critical' || sev === 'High' }

/** Pure evaluation. Never throws for data problems — it records them as fail reasons. */
export function evaluateGate(scorecard: unknown, opts: GateOptions = {}): GateResult {
  const reasons: GateReason[] = []
  const totalsBySeverity: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 }
  let achTotal = 0, achOpen = 0, physicalCount = 0, externalCount = 0

  const sc = scorecard as Partial<Scorecard> | null
  const build = sc?.fingerprint?.build ?? 'UNKNOWN'
  const commit = sc?.fingerprint?.commit ?? 'UNKNOWN'

  if (!sc || typeof sc !== 'object') {
    reasons.push({ id: '(root)', code: 'INVALID_SCORECARD', detail: 'scorecard is not an object' })
    return done(false)
  }
  if (!Array.isArray(sc.rows) || sc.rows.length === 0) {
    reasons.push({ id: '(root)', code: 'EMPTY', detail: 'scorecard has no rows' })
    return done(false)
  }
  // Fingerprint must be a FULL 40-hex SHA — a prefix-only fingerprint can silently
  // match a stale build; it is not an acceptable candidate identity.
  if (!/^[0-9a-f]{40}$/.test(String(sc.fingerprint?.commit ?? ''))) {
    reasons.push({ id: '(root)', code: 'PREFIX_ONLY_FINGERPRINT', detail: `scorecard commit '${sc.fingerprint?.commit}' is not a full 40-hex SHA` })
  }
  // Staleness: the scorecard must describe the CURRENT commit (unless --fast).
  if (!opts.fast && opts.actualCommit && sc.fingerprint?.commit && sc.fingerprint.commit !== opts.actualCommit) {
    reasons.push({ id: '(root)', code: 'STALE_FINGERPRINT', detail: `scorecard commit ${sc.fingerprint.commit} != HEAD ${opts.actualCommit}` })
  }

  const seenIds = new Set<string>()
  const evidenceSig = new Map<string, string>() // signature -> first row id (copy detection)
  for (const row of sc.rows) {
    const id = (row && typeof row === 'object' && 'id' in row && typeof row.id === 'string') ? row.id : '(missing-id)'
    // Schema validation.
    for (const f of REQUIRED_FIELDS) {
      if (!(f in row) || row[f] === undefined || row[f] === null) reasons.push({ id, code: 'MISSING_FIELD', detail: `missing '${String(f)}'` })
    }
    if (seenIds.has(id)) reasons.push({ id, code: 'DUPLICATE_ID', detail: 'id used more than once' })
    seenIds.add(id)
    if (!SEVERITIES.includes(row.severity)) reasons.push({ id, code: 'BAD_SEVERITY', detail: String(row.severity) })
    if (!CLASSIFICATIONS.includes(row.classification)) reasons.push({ id, code: 'BAD_CLASSIFICATION', detail: String(row.classification) })
    if (!STATUSES.includes(row.status)) reasons.push({ id, code: 'BAD_STATUS', detail: String(row.status) })
    if (ladderIndex(row.minEvidenceClass) < 0) reasons.push({ id, code: 'BAD_MIN_EVIDENCE', detail: String(row.minEvidenceClass) })
    if (ladderIndex(row.currentEvidenceClass) < 0) reasons.push({ id, code: 'BAD_CUR_EVIDENCE', detail: String(row.currentEvidenceClass) })

    if (SEVERITIES.includes(row.severity)) totalsBySeverity[row.severity] = (totalsBySeverity[row.severity] ?? 0) + 1
    if (row.classification === 'physical') physicalCount += 1
    if (row.classification === 'external') externalCount += 1

    // Blocker integrity: PHYSICAL_ONLY / EXTERNAL_BLOCKER must be honestly classified + proven.
    if (row.status === 'PHYSICAL_ONLY') {
      if (row.classification !== 'physical') reasons.push({ id, code: 'MISCLASSIFIED_PHYSICAL', detail: 'PHYSICAL_ONLY on a non-physical row' })
      if (!row.blockerProof) reasons.push({ id, code: 'FAKE_PHYSICAL_BLOCKER', detail: 'PHYSICAL_ONLY without blockerProof' })
    }
    if (row.status === 'EXTERNAL_BLOCKER') {
      if (row.classification !== 'external') reasons.push({ id, code: 'MISCLASSIFIED_EXTERNAL', detail: 'EXTERNAL_BLOCKER on a non-external row' })
      if (!row.blockerProof) reasons.push({ id, code: 'FAKE_EXTERNAL_BLOCKER', detail: 'EXTERNAL_BLOCKER without blockerProof' })
    }

    // The core contract: every AUTOMATABLE Critical/High row must be truly PROVEN.
    if (row.classification === 'automatable' && isCriticalHigh(row.severity)) {
      achTotal += 1
      let open = false
      if (row.status !== 'PROVEN') { open = true; reasons.push({ id, code: 'OPEN_ROW', detail: `status=${row.status}` }) }
      if (ladderIndex(row.currentEvidenceClass) < ladderIndex(row.minEvidenceClass)) {
        open = true
        reasons.push({ id, code: 'EVIDENCE_DEFICIT', detail: `${row.currentEvidenceClass} < required ${row.minEvidenceClass}` })
      }
      const hasEvidence = (Array.isArray(row.tests) && row.tests.length > 0) || (typeof row.evidenceArtifact === 'string' && row.evidenceArtifact.trim().length > 0)
      if (row.status === 'PROVEN' && !hasEvidence) { open = true; reasons.push({ id, code: 'FALSE_GREEN', detail: 'PROVEN with no tests and no evidenceArtifact' }) }
      // Cited evidence must actually EXIST on disk — defeats a deleted/renamed/
      // nonexistent test path masquerading as green.
      if (row.status === 'PROVEN' && opts.fileExists) {
        for (const t of Array.isArray(row.tests) ? row.tests : []) {
          if (!opts.fileExists(t)) { open = true; reasons.push({ id, code: 'MISSING_TEST_FILE', detail: `cited test does not exist: ${t}` }) }
        }
        const artifactPath = String(row.evidenceArtifact ?? '').split('#')[0]!
        if (artifactPath.includes('/') && !opts.fileExists(artifactPath)) {
          open = true; reasons.push({ id, code: 'MISSING_EVIDENCE_ARTIFACT', detail: `cited artifact does not exist: ${artifactPath}` })
        }
      }
      // Copy detection: two PROVEN rows sharing the EXACT same evidence signature
      // (sorted tests + artifact) is a blind copy, not independent proof.
      if (row.status === 'PROVEN' && hasEvidence) {
        const sig = [...(Array.isArray(row.tests) ? row.tests : [])].sort().join('|') + '::' + String(row.evidenceArtifact ?? '')
        const prior = evidenceSig.get(sig)
        if (prior) { open = true; reasons.push({ id, code: 'DUPLICATE_EVIDENCE', detail: `identical evidence to row ${prior}` }) }
        else evidenceSig.set(sig, id)
      }
      if (row.status === 'PROVEN' && (!row.rollbackTrigger || row.rollbackTrigger.trim() === '')) {
        open = true; reasons.push({ id, code: 'MISSING_ROLLBACK', detail: 'PROVEN without a rollbackTrigger' })
      }
      // A PROVEN row must be fingerprinted to the candidate build (no stale green).
      if (row.status === 'PROVEN' && row.fingerprint?.build && sc.fingerprint?.build && row.fingerprint.build !== sc.fingerprint.build) {
        open = true; reasons.push({ id, code: 'STALE_ROW_BUILD', detail: `row build ${row.fingerprint.build} != candidate ${sc.fingerprint.build}` })
      }
      // A row whose acceptance needs deployment must reach DEPLOYED_PREVIEW to be PROVEN.
      if (row.status === 'TESTED_NOT_DEPLOYED') { open = true } // already counted OPEN_ROW above
      if (open) achOpen += 1
    } else {
      // A non-automatable row may NOT hide automatable work: an automatable-looking
      // Critical/High surface classified physical/external without a blocker proof is a defect.
      if (isCriticalHigh(row.severity) && (row.classification === 'external' || row.classification === 'physical') && !row.blockerProof) {
        reasons.push({ id, code: 'UNPROVEN_BLOCKER_HIDES_WORK', detail: `${row.classification} Critical/High without blockerProof` })
      }
    }
  }

  // Inventory reconciliation: every REQUIRED Critical/High inventory id must be
  // represented by a row. Deleting or omitting a required row cannot pass the gate.
  for (const reqId of opts.requiredInventoryIds ?? []) {
    if (!seenIds.has(reqId)) reasons.push({ id: reqId, code: 'MISSING_INVENTORY_ROW', detail: 'required Critical/High inventory id has no scorecard row' })
  }

  const pass = reasons.length === 0 && achOpen === 0
  return done(pass)

  function done(p: boolean): GateResult {
    return {
      pass: p, commit, build, totalsBySeverity,
      automatableCriticalHighTotal: achTotal, automatableCriticalHighOpen: achOpen,
      physicalCount, externalCount, reasons,
    }
  }
}

/** Human/evaluator-readable one-screen summary. */
export function formatGateResult(r: GateResult): string {
  const lines: string[] = []
  lines.push(`ABU AI PRODUCTION GATE — ${r.pass ? 'PASS' : 'FAIL'}`)
  lines.push(`commit=${r.commit} build=${r.build}`)
  lines.push(`rows: Critical=${r.totalsBySeverity.Critical} High=${r.totalsBySeverity.High} Medium=${r.totalsBySeverity.Medium} Low=${r.totalsBySeverity.Low}`)
  lines.push(`automatable Critical/High: ${r.automatableCriticalHighTotal} total · ${r.automatableCriticalHighOpen} OPEN`)
  lines.push(`physical rows=${r.physicalCount} · external rows=${r.externalCount}`)
  if (r.reasons.length) {
    lines.push(`reasons (${r.reasons.length}):`)
    for (const reason of r.reasons) lines.push(`  - [${reason.code}] ${reason.id}: ${reason.detail}`)
  }
  lines.push(r.pass ? 'RESULT: PASS (0 open automatable Critical/High)' : 'RESULT: FAIL')
  return lines.join('\n')
}
