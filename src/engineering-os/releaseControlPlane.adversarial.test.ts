/*
 * SPECIFICATION-DERIVED ADVERSARIAL SUITE for the release control plane.
 * ═════════════════════════════════════════════════════════════════════
 * ORACLE PROVENANCE (Section 13): the expected refusal reason for every case is
 * derived from the CONTROL-PLANE SPECIFICATION (the Stage-1 program, Section 15) —
 * NOT from observing what the gate currently does. Each case seeds exactly one
 * false-READY / false-handoff condition and asserts BOTH:
 *   (1) the expected verdict/refusal occurred, AND
 *   (2) it occurred for the expected SPEC-DERIVED control reason.
 * A refusal for a DIFFERENT reason is FAIL (the gate may be blocking accidentally).
 *
 * COMMON_MODE_ORACLE_RISK (declared, not hidden): the gate and this suite are
 * authored in the same run. Mitigations: (a) expected reasons are written from the
 * spec's semantics; (b) every detector must also STAY SILENT on the green baseline
 * (the negative), so a detector that fires unconditionally fails its green check.
 * This is CODE evidence for the control plane — not device/production proof.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  evaluateControlPlane,
  type ControlPlaneInput,
  type ControlPlaneState,
} from './releaseControlPlane'
import type { ReleaseState } from './releaseGate'

const NOW = '2026-08-16T00:00:00.000Z'
const CP_ID = 'cp_frozen00'
const SHA = 'candidateB0000000000000000000000000000000'

// ── Green baselines ──────────────────────────────────────────────────────────
const EXISTING = new Set(['a.test.ts', 'b.test.ts', 'genome.test.ts', 'mutant.test.ts'])

function greenRelease(): ReleaseState {
  return {
    claudeMustProve: [{ item: 'persistence', status: 'PROVEN' }, { item: 'routing', status: 'PROVEN' }],
    doneStatuses: ['PROVEN', 'PROVEN_PREVIEW', 'DONE'],
    evidenceClaims: [
      { claim: 'persistence', test: 'a.test.ts', result: 'PASS', evidenceLevel: 'PREVIEW', mode: 'playwright' },
      { claim: 'routing', test: 'b.test.ts :: routes', result: 'PASS', evidenceLevel: 'CODE' },
    ],
    genome: [{ failureId: 'F01', regressionTest: 'genome.test.ts' }],
    metaMutation: [{ invariant: 'durable', caughtBy: 'mutant.test.ts' }],
    blindSpots: [{ defectClass: 'iOS partition', status: 'PHYSICAL_IPHONE_ONLY', automatable: false }],
    git: { head: 'abc', remote: 'abc', dirtyRuntime: [] },
    deploy: { healthBuildVersion: '0.286.0', expectedBuildVersion: '0.286.0', aliasOk: true },
    testFileExists: (p) => EXISTING.has(p),
    suiteResult: () => 'pass',
    requiredSuites: ['a.test.ts', 'b.test.ts'],
    gates: { aToC: true, realProviderMatrix: true, enlargedText: true, privacyScan: 'pass' },
    codeArtifactCommitsDiffer: false,
    commitsDocOnlyClassified: false,
    productUniversePresent: true,
    masterMatrixPresent: true,
    criticalCoverageGaps: [],
  }
}

/** A fully-green control-plane input that must evaluate GO with an eligible handoff. */
function greenInput(): ControlPlaneInput {
  return {
    release: greenRelease(),
    requiredClaims: [
      { id: 'persistence', floorSeverity: 'P0', critical: true },
      { id: 'routing', floorSeverity: 'P1', critical: true },
      { id: 'enlarged-text', floorSeverity: 'P2', critical: false },
    ],
    presentClaims: [
      { id: 'persistence', applicability: 'REQUIRED', assignedSeverity: 'P0', status: 'PROVEN' },
      { id: 'routing', applicability: 'REQUIRED', assignedSeverity: 'P1', status: 'PROVEN' },
      { id: 'enlarged-text', applicability: 'NOT_APPLICABLE', naReason: 'no UI change in this candidate', assignedSeverity: 'P2', status: 'NOT_APPLICABLE' },
    ],
    riskAreas: [
      { area: 'release-gate', floorTier: 3, appliedTier: 3 },
      { area: 'privacy', floorTier: 3, appliedTier: 3 },
    ],
    changeImpact: [
      { changedNode: 'src/engineering-os/releaseControlPlane.ts', knownRequiredModules: ['releaseGate', 'owner-firewall'], resolvedModules: ['releaseGate', 'owner-firewall'] },
    ],
    evaluators: [
      { name: 'release-gate', required: true, status: 'OK' },
      { name: 'owner-firewall', required: true, status: 'OK' },
    ],
    candidateSha: SHA,
    controlPlaneId: CP_ID,
    frozenControlPlaneId: CP_ID,
    owner: {
      requested: true,
      parity: {
        property: 'real mic acoustics',
        candidateSha: SHA,
        controlPlaneId: CP_ID,
        automatedTwin: 'OK',
        automatedTwinResult: 'PASS',
        evidenceRefs: ['e2e/injected-voice.spec.ts'],
        expiresAt: '2026-09-01T00:00:00.000Z',
        residualClass: 'IRREDUCIBLE_HUMAN_RESIDUAL',
      },
    },
    holdouts: [{ id: 'H1', claimsIndependent: true, exposed: false }],
    now: NOW,
  }
}

/** All emitted codes across GATE D blockers, meta-blockers, and owner refusal. */
function allCodes(s: ControlPlaneState): string[] {
  return [
    ...s.releaseBlockers.map((b) => b.code),
    ...s.controlBlockers.map((b) => b.code),
    ...(s.ownerHandoff.refusalCode ? [s.ownerHandoff.refusalCode] : []),
  ]
}

// ── Green baseline: every detector must stay SILENT ──────────────────────────
describe('control plane — green baseline (all detectors silent)', () => {
  it('a fully-green input is GO with an eligible owner handoff and zero meta-blockers', () => {
    const s = evaluateControlPlane(greenInput())
    expect(s.verdict, JSON.stringify(allCodes(s))).toBe('GO')
    expect(s.controlBlockers).toEqual([])
    expect(s.releaseBlockers).toEqual([])
    expect(s.ownerHandoff.eligible).toBe(true)
  })
})

// ── KERNEL_SELF_TEST (cheap minimum checks, every run) ───────────────────────
describe('KERNEL_SELF_TEST', () => {
  it('green baseline is GO', () => {
    expect(evaluateControlPlane(greenInput()).verdict).toBe('GO')
  })
  it('seeded P0 (incomplete CLAUDE_MUST_PROVE) is rejected', () => {
    const i = greenInput(); i.release.claudeMustProve[0]!.status = 'PARTIAL'
    const s = evaluateControlPlane(i)
    expect(s.verdict).toBe('NO-GO')
    expect(s.releaseBlockers.map((b) => b.code)).toContain('CLAUDE_MUST_PROVE_INCOMPLETE')
  })
  it('critical UNKNOWN is rejected (not PASS)', () => {
    const i = greenInput(); i.presentClaims[0]!.status = 'UNKNOWN'
    const s = evaluateControlPlane(i)
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('CRITICAL_UNKNOWN')
  })
  it('candidate mismatch on owner parity is rejected', () => {
    const i = greenInput(); i.owner.parity!.candidateSha = 'someOtherCandidate'
    expect(evaluateControlPlane(i).ownerHandoff.refusalCode).toBe('OWNER_PARITY_CANDIDATE_MISMATCH')
  })
  it('owner handoff without parity is rejected', () => {
    const i = greenInput(); delete i.owner.parity
    expect(evaluateControlPlane(i).ownerHandoff.refusalCode).toBe('OWNER_PARITY_MISSING')
  })
  it('a degenerate empty state cannot produce GO', () => {
    const i = greenInput()
    i.release.claudeMustProve = []
    i.release.deploy = { healthBuildVersion: null, expectedBuildVersion: '0.286.0', aliasOk: false }
    i.evaluators = [{ name: 'release-gate', required: true, status: 'NOT_EXECUTED' }]
    expect(evaluateControlPlane(i).verdict).not.toBe('GO')
  })
})

// ── The specification-derived adversarial suite (A–O) ────────────────────────
interface CaseResult {
  scenario: string
  expectedReason: string
  actualVerdict: string
  actualReason: string
  outcome: 'PASS' | 'FAIL' | 'EVALUATOR_CRASHED' | 'EVIDENCE_MISSING' | 'NOT_EXECUTED'
  evidence: string
}
const results: CaseResult[] = []

/**
 * Run one adversarial case. PASS iff the expected spec-derived reason code is
 * actually emitted. The primary actualReason recorded is the expected code when
 * present (proving the RIGHT mechanism fired), else the first emitted code (proving
 * it fired for the WRONG reason → FAIL) or '(none)'.
 */
function runCase(
  scenario: string,
  expectedReason: string,
  mutate: (i: ControlPlaneInput) => void,
  opts: { ownerFocused?: boolean } = {},
): ControlPlaneState {
  const i = greenInput()
  mutate(i)
  let s: ControlPlaneState
  try {
    s = evaluateControlPlane(i)
  } catch (e) {
    results.push({ scenario, expectedReason, actualVerdict: 'THREW', actualReason: String(e), outcome: 'EVALUATOR_CRASHED', evidence: 'exception' })
    throw e
  }
  const codes = allCodes(s)
  const hit = codes.includes(expectedReason)
  const actualReason = hit ? expectedReason : (codes[0] ?? '(none)')
  const actualVerdict = opts.ownerFocused
    ? (s.ownerHandoff.eligible ? 'HANDOFF_ELIGIBLE' : 'HANDOFF_REFUSED')
    : s.verdict
  results.push({
    scenario,
    expectedReason,
    actualVerdict,
    actualReason,
    outcome: hit ? 'PASS' : 'FAIL',
    evidence: 'src/engineering-os/releaseControlPlane.adversarial.test.ts',
  })
  return s
}

describe('adversarial suite — every case, both verdict AND reason', () => {
  it('A · all product tests green, wrong deployed SHA → NO-GO (FINGERPRINT_MISMATCH)', () => {
    const s = runCase('A wrong deployed SHA', 'FINGERPRINT_MISMATCH', (i) => { i.release.deploy.healthBuildVersion = '0.285.0' })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('FINGERPRINT_MISMATCH')
  })

  it('B · one critical UNKNOWN → NO-GO (CRITICAL_UNKNOWN)', () => {
    const s = runCase('B critical UNKNOWN', 'CRITICAL_UNKNOWN', (i) => { i.presentClaims[0]!.status = 'UNKNOWN' })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('CRITICAL_UNKNOWN')
  })

  it('C · product ready but owner parity missing → handoff prohibited (OWNER_PARITY_MISSING)', () => {
    const s = runCase('C owner parity missing', 'OWNER_PARITY_MISSING', (i) => { delete i.owner.parity }, { ownerFocused: true })
    expect(s.ownerHandoff.eligible).toBe(false)
    expect(s.ownerHandoff.refusalCode).toBe('OWNER_PARITY_MISSING')
  })

  it('D · parity belongs to candidate A, current is B → parity rejected (OWNER_PARITY_CANDIDATE_MISMATCH)', () => {
    const s = runCase('D parity wrong candidate', 'OWNER_PARITY_CANDIDATE_MISMATCH', (i) => { i.owner.parity!.candidateSha = 'candidateA0000' }, { ownerFocused: true })
    expect(s.ownerHandoff.eligible).toBe(false)
    expect(s.ownerHandoff.refusalCode).toBe('OWNER_PARITY_CANDIDATE_MISMATCH')
  })

  it('E · narrative attempts phone test while machine NO-GO → owner action refused (NARRATIVE_BYPASS_BLOCKED)', () => {
    const s = runCase('E narrative bypass', 'NARRATIVE_BYPASS_BLOCKED', (i) => {
      i.presentClaims[0]!.status = 'UNKNOWN' // force NO-GO
      i.narrativeRequestsOwnerAction = true
    }, { ownerFocused: true })
    expect(s.verdict).toBe('NO-GO')
    expect(s.ownerHandoff.eligible).toBe(false)
    expect(s.ownerHandoff.refusalCode).toBe('NARRATIVE_BYPASS_BLOCKED')
  })

  it('F · P0 relabeled P2 without downgrade proof → refused (SEVERITY_DOWNGRADE_UNPROVEN)', () => {
    const s = runCase('F severity downgrade', 'SEVERITY_DOWNGRADE_UNPROVEN', (i) => { i.presentClaims[0]!.assignedSeverity = 'P2' })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('SEVERITY_DOWNGRADE_UNPROVEN')
  })

  it('G · release gate changed after certification → certification expired (CONTROL_PLANE_MISMATCH)', () => {
    const s = runCase('G gate changed post-cert', 'CONTROL_PLANE_MISMATCH', (i) => { i.controlPlaneId = 'cp_changed99' })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('CONTROL_PLANE_MISMATCH')
  })

  it('H · required critical claim entirely absent → NO-GO (EXPECTED_CLAIM_ABSENT)', () => {
    const s = runCase('H required claim absent', 'EXPECTED_CLAIM_ABSENT', (i) => { i.presentClaims = i.presentClaims.filter((c) => c.id !== 'persistence') })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('EXPECTED_CLAIM_ABSENT')
  })

  it('I · critical claim marked N/A without valid proof → NO-GO (INVALID_NA)', () => {
    const s = runCase('I invalid N/A', 'INVALID_NA', (i) => {
      const c = i.presentClaims.find((x) => x.id === 'persistence')!
      c.applicability = 'NOT_APPLICABLE'; c.naReason = ''
    })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('INVALID_NA')
  })

  it('J · risk tier below constitutional floor without proof → refusal (RISK_FLOOR_VIOLATION)', () => {
    const s = runCase('J risk floor', 'RISK_FLOOR_VIOLATION', (i) => { i.riskAreas[0]!.appliedTier = 1 })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('RISK_FLOOR_VIOLATION')
  })

  it('K · change-impact resolver omits a known required module → validation failure (CHANGE_IMPACT_MODULE_OMITTED)', () => {
    const s = runCase('K change-impact omission', 'CHANGE_IMPACT_MODULE_OMITTED', (i) => { i.changeImpact[0]!.resolvedModules = ['releaseGate'] })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('CHANGE_IMPACT_MODULE_OMITTED')
  })

  it('L · owner parity plausible PASS text but stale/expired evidence → handoff refused (OWNER_PARITY_STALE)', () => {
    const s = runCase('L parity stale evidence', 'OWNER_PARITY_STALE', (i) => { i.owner.parity!.expiresAt = '2026-08-01T00:00:00.000Z' }, { ownerFocused: true })
    expect(s.ownerHandoff.eligible).toBe(false)
    expect(s.ownerHandoff.refusalCode).toBe('OWNER_PARITY_STALE')
  })

  it('M · control plane changes after certification begins → affected certification expires (CONTROL_PLANE_MISMATCH)', () => {
    const s = runCase('M control-plane drift', 'CONTROL_PLANE_MISMATCH', (i) => { i.frozenControlPlaneId = 'cp_frozenOLD' })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('CONTROL_PLANE_MISMATCH')
  })

  it('N · previously exposed failed holdout reused as independent → rejected (HOLDOUT_NOT_INDEPENDENT)', () => {
    const s = runCase('N holdout not independent', 'HOLDOUT_NOT_INDEPENDENT', (i) => { i.holdouts![0]!.exposed = true })
    expect(s.verdict).toBe('NO-GO')
    expect(allCodes(s)).toContain('HOLDOUT_NOT_INDEPENDENT')
  })

  it('O · required evaluator crashes before producing result → BLOCKED (EVALUATOR_CRASHED)', () => {
    const s = runCase('O evaluator crashed', 'EVALUATOR_CRASHED', (i) => { i.evaluators[0]!.status = 'CRASHED' })
    expect(s.verdict).toBe('BLOCKED') // non-binary: neither GO nor a normal FAIL
    expect(allCodes(s)).toContain('EVALUATOR_CRASHED')
  })
})

afterAll(() => {
  const passed = results.filter((r) => r.outcome === 'PASS').length
  const artifact = {
    $schema: 'internal://abu/control-plane-adversarial-result',
    generatedFor: 'Stage 1 — control-plane falsification (spec-derived oracle)',
    now: NOW,
    controlPlaneId: CP_ID,
    commonModeOracleRisk: 'DECLARED: gate + suite authored same run; mitigated by spec-first expected reasons + green-baseline silence per detector. CODE evidence only.',
    totalCases: results.length,
    passed,
    failed: results.length - passed,
    cases: results,
  }
  try {
    mkdirSync(resolve(process.cwd(), 'docs/engineering-os/qa'), { recursive: true })
    writeFileSync(
      resolve(process.cwd(), 'docs/engineering-os/qa/control-plane-adversarial-result.json'),
      JSON.stringify(artifact, null, 2) + '\n',
    )
  } catch { /* artifact is a convenience; the assertions are the authority */ }
})
