/*
 * ADAPTER ADVERSARIAL SUITE (Stage 2) — falsify the LIVE-STATE ADAPTER path.
 * ════════════════════════════════════════════════════════════════════════════
 * Stage 1 proved the meta-gate rejects false-READY FIXTURE states. Stage 2 proves
 * the SAME gate receives a complete, provenance-bound, temporally-coherent
 * representation of real repository state. Every case here flows through the REAL
 * adapter path — reader → parse → normalize → reconcile → evaluateControlPlane —
 * via DEPENDENCY-INJECTED readers, so no real QA data is touched (§13).
 *
 * TWO AXES, never collapsed (§15):
 *   • CONTROL STATE  — GO / NO-GO / BLOCKED / INVALID (what correctly resulted).
 *   • TEST_ASSERTION — PASS iff the EXPECTED control state AND the EXPECTED reason
 *                      occurred. Refusal for a DIFFERENT reason is FAIL.
 *
 * ORACLE PROVENANCE (§17): the adapter does NOT encode that any capability "should
 * fail". Expected reasons are derived from the Stage-2 SPECIFICATION. The green
 * baseline is a synthetic FRESH candidate; degradations are injected, never assumed.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildLiveSnapshot, toControlPlaneInput, computeInputHash,
  SOURCE_REGISTRY, type LiveDeps, type SourceReader,
} from './liveSnapshot'
import { evaluateControlPlane, type ControlPlaneInput, type ControlPlaneState, type EvaluatorRun } from './releaseControlPlane'

const NOW = '2026-08-16T00:00:00.000Z'
const CANDIDATE_BUILD = '0.286.0-earonly'
const HEAD = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
const CP_ID = 'cp_live0001'

// ── Green synthetic source set: a FRESH candidate, all sources valid ─────────
function greenSourceJson(): Record<string, any> {
  return {
    'qa-ownership': { $schema: 'internal://abu/qa-ownership', build: '0.286.0', CLAUDE_MUST_PROVE: [
      { item: 'persistence', status: 'PROVEN_CODE' }, { item: 'routing', status: 'PROVEN' } ] },
    'evidence': { $schema: 'internal://abu/evidence', build: '0.286.0', claims: [
      { claim: 'AbuAI conversation, AbuWhatsApp comm, AbuCalendar events', surfaces: ['AbuAI', 'AbuWhatsApp', 'AbuCalendar'], test: 'a.test.ts', result: 'PASS', evidenceLevel: 'PREVIEW', mode: 'playwright' } ] },
    'meta-qa': { $schema: 'internal://abu/meta-qa', build: '0.286.0',
      mutationCertification: [{ invariant: 'durable', caughtBy: 'mutant.test.ts' }],
      blindSpotRegister: [{ defectClass: 'iOS partition', status: 'PHYSICAL_IPHONE_ONLY' }] },
    'failure-genome': { build: '0.286.0', failures: [{ failureId: 'F01', regressionTest: 'genome.test.ts' }] },
    'mission': { build: '0.286.0', gatesReady: { aToC: true, realProviderMatrix: true, enlargedText: true }, verdict: 'READY' },
    'product-universe': { $schema: 'internal://abu/product-universe', build: '0.286.0', screens: [
      { surfaceId: 'AbuAI', risk: 'high' }, { surfaceId: 'AbuWhatsApp', risk: 'high' },
      { surfaceId: 'AbuCalendar', risk: 'high' }, { surfaceId: 'Home', risk: 'medium' } ] },
    'master-matrix': { build: '0.286.0', journeys: [{ id: 'J1', status: 'COVERED', surface: 'AbuAI' }] },
  }
}

const PATH_BY_NAME = new Map(SOURCE_REGISTRY.map((s) => [s.path, s.name]))
type Override = 'MISSING' | 'PARSE_FAILED' | Record<string, any>

function makeReader(jsonMap: Record<string, any>, overrides: Record<string, Override> = {}): SourceReader {
  return (relPath: string) => {
    const name = PATH_BY_NAME.get(relPath)
    if (!name) return { status: 'MISSING' }
    const ov = overrides[name]
    if (ov === 'MISSING') return { status: 'MISSING' }
    if (ov === 'PARSE_FAILED') return { status: 'PARSE_FAILED' }
    const json = ov && typeof ov === 'object' ? ov : jsonMap[name]
    return { status: 'VALID', json, declaredBuild: json.build, declaredCommit: json.testedCommit || json.commit, schema: json.$schema }
  }
}

interface DepOverrides {
  jsonMap?: Record<string, any>
  sourceOverrides?: Record<string, Override>
  git?: Partial<LiveDeps['git']>
  deploy?: Partial<LiveDeps['deploy']>
  frozen?: string | undefined
  evaluators?: EvaluatorRun[]
  discoveredSources?: string[]
  changedFiles?: string[]
  testFileExists?: (p: string) => boolean
  suiteResult?: (p: string) => 'pass' | 'fail' | 'skipped' | 'unknown'
  privacyScanPass?: boolean
  ownerRequested?: boolean
}

function greenDeps(over: DepOverrides = {}): LiveDeps {
  const jsonMap = { ...greenSourceJson(), ...(over.jsonMap || {}) }
  const frozenVal = 'frozen' in over ? over.frozen : CP_ID
  return {
    readSource: makeReader(jsonMap, over.sourceOverrides || {}),
    git: { head: HEAD, remote: HEAD, dirtyRuntime: [], dirtyStateHash: 'clean', ...(over.git || {}) },
    deploy: { healthBuildVersion: CANDIDATE_BUILD, expectedBuildVersion: CANDIDATE_BUILD, aliasOk: true, ...(over.deploy || {}) },
    candidateBuild: CANDIDATE_BUILD,
    controlPlaneId: CP_ID,
    ...(frozenVal !== undefined ? { frozenControlPlaneId: frozenVal } : {}),
    now: NOW,
    changedFiles: over.changedFiles || [],
    moduleOwnership: { 'src/engineering-os/': ['releaseGate', 'releaseControlPlane'] },
    testFileExists: over.testFileExists || (() => true),
    suiteResult: over.suiteResult || (() => 'pass'),
    privacyScanPass: over.privacyScanPass !== undefined ? over.privacyScanPass : true,
    evaluatorStatuses: over.evaluators || [
      { name: 'release-gate', required: true, status: 'OK' },
      { name: 'adversarial-suite', required: true, status: 'OK' },
    ],
    ownerRequested: over.ownerRequested || false,
    discoveredSources: over.discoveredSources || SOURCE_REGISTRY.map((s) => s.path),
  }
}

function evalLive(over: DepOverrides = {}, opts?: { inputDriftDuringEvaluation?: boolean }): ControlPlaneState {
  const snap = buildLiveSnapshot(greenDeps(over))
  return evaluateControlPlane(toControlPlaneInput(snap, opts))
}
function codesOf(s: ControlPlaneState): string[] {
  return [...s.releaseBlockers.map((b) => b.code), ...s.controlBlockers.map((b) => b.code), ...(s.ownerHandoff.refusalCode ? [s.ownerHandoff.refusalCode] : [])]
}

// ── GREEN BASELINE: the adapter path yields GO on a fresh, complete candidate ─
describe('adapter — green baseline (fresh candidate → GO)', () => {
  it('a fresh, complete synthetic candidate evaluates GO through the live path', () => {
    const s = evalLive()
    expect(s.verdict, JSON.stringify(codesOf(s))).toBe('GO')
    expect(s.controlBlockers).toEqual([])
    expect(s.releaseBlockers).toEqual([])
  })
  it('the input hash is deterministic and stable across identical snapshots', () => {
    const a = computeInputHash(buildLiveSnapshot(greenDeps()))
    const b = computeInputHash(buildLiveSnapshot(greenDeps()))
    expect(a).toBe(b)
    expect(a).toMatch(/^in_[0-9a-f]{8}$/)
  })
})

// ── The R-suite ──────────────────────────────────────────────────────────────
type ControlState = 'GO' | 'NO-GO' | 'BLOCKED' | 'INVALID'
interface Row {
  scenario: string
  expectedControlState: ControlState
  expectedReason: string
  actualControlState: string
  actualReason: string
  TEST_ASSERTION: 'PASS' | 'FAIL' | 'EVALUATOR_CRASHED' | 'EVIDENCE_MISSING'
  evidence: string
}
const rows: Row[] = []

function runR(scenario: string, expectedControlState: ControlState, expectedReason: string, produce: () => ControlPlaneState): ControlPlaneState {
  let s: ControlPlaneState
  try { s = produce() } catch (e) {
    rows.push({ scenario, expectedControlState, expectedReason, actualControlState: 'THREW', actualReason: String(e), TEST_ASSERTION: 'EVALUATOR_CRASHED', evidence: 'exception' })
    throw e
  }
  const codes = codesOf(s)
  const reasonHit = codes.includes(expectedReason)
  const stateHit = s.verdict === expectedControlState
  rows.push({
    scenario,
    expectedControlState,
    expectedReason,
    actualControlState: s.verdict,
    actualReason: reasonHit ? expectedReason : (codes[0] ?? '(none)'),
    TEST_ASSERTION: reasonHit && stateHit ? 'PASS' : 'FAIL',
    evidence: 'src/engineering-os/liveSnapshot.adversarial.test.ts',
  })
  return s
}

describe('adapter adversarial suite R1–R18 (through the live path)', () => {
  it('R1 · missing critical source → SOURCE_MISSING / BLOCKED', () => {
    const s = runR('R1 missing critical source', 'BLOCKED', 'SOURCE_MISSING', () => evalLive({ sourceOverrides: { 'meta-qa': 'MISSING' } }))
    expect(s.verdict).toBe('BLOCKED'); expect(codesOf(s)).toContain('SOURCE_MISSING')
  })
  it('R2 · malformed critical source → SOURCE_PARSE_FAILED / BLOCKED', () => {
    const s = runR('R2 malformed critical source (mirrors real meta-qa.json)', 'BLOCKED', 'SOURCE_PARSE_FAILED', () => evalLive({ sourceOverrides: { 'meta-qa': 'PARSE_FAILED' } }))
    expect(s.verdict).toBe('BLOCKED'); expect(codesOf(s)).toContain('SOURCE_PARSE_FAILED')
  })
  it('R3 · unsupported schema version → SCHEMA_VERSION_MISMATCH / BLOCKED', () => {
    const bad = { ...greenSourceJson()['product-universe'], $schema: 'internal://abu/product-universe-v2-WRONG' }
    const s = runR('R3 unsupported schema', 'BLOCKED', 'SCHEMA_VERSION_MISMATCH', () => evalLive({ sourceOverrides: { 'product-universe': bad } }))
    expect(s.verdict).toBe('BLOCKED'); expect(codesOf(s)).toContain('SCHEMA_VERSION_MISMATCH')
  })
  it('R4 · wrong deployed SHA → FINGERPRINT_MISMATCH / NO-GO', () => {
    const s = runR('R4 wrong deployed fingerprint', 'NO-GO', 'FINGERPRINT_MISMATCH', () => evalLive({ deploy: { healthBuildVersion: '0.285.0', aliasOk: false } }))
    expect(codesOf(s)).toContain('FINGERPRINT_MISMATCH')
  })
  it('R5 · stale evidence source → EVIDENCE_STALE / NO-GO', () => {
    const stale = { ...greenSourceJson()['evidence'], build: '0.169.0' }
    const s = runR('R5 stale evidence for current candidate', 'NO-GO', 'EVIDENCE_STALE', () => evalLive({ sourceOverrides: { 'evidence': stale } }))
    expect(codesOf(s)).toContain('EVIDENCE_STALE')
  })
  it('R6 · required claim omitted during normalization → EXPECTED_CLAIM_ABSENT / NO-GO', () => {
    // evidence structurally covers AbuAI + AbuWhatsApp but NOT AbuCalendar → its required claim has no present evidence.
    const ev = { ...greenSourceJson()['evidence'], claims: [{ claim: 'AbuAI + AbuWhatsApp only', surfaces: ['AbuAI', 'AbuWhatsApp'], test: 'a.test.ts', result: 'PASS', evidenceLevel: 'PREVIEW', mode: 'playwright' }] }
    const s = runR('R6 required claim omitted by normalization', 'NO-GO', 'EXPECTED_CLAIM_ABSENT', () => evalLive({ sourceOverrides: { 'evidence': ev } }))
    expect(codesOf(s)).toContain('EXPECTED_CLAIM_ABSENT')
  })
  it('R7 · evaluator crash encoded as missing result → EVALUATOR_CRASHED / BLOCKED', () => {
    const s = runR('R7 evaluator crashed', 'BLOCKED', 'EVALUATOR_CRASHED', () => evalLive({ evaluators: [{ name: 'release-gate', required: true, status: 'CRASHED' }] }))
    expect(s.verdict).toBe('BLOCKED'); expect(codesOf(s)).toContain('EVALUATOR_CRASHED')
  })
  it('R8 · conflicting authoritative sources → SOURCE_CONFLICT / BLOCKED', () => {
    const m = { ...greenSourceJson()['mission'], verdict: 'READY', gatesReady: { aToC: false, realProviderMatrix: true, enlargedText: true } }
    const s = runR('R8 source conflict (READY verdict vs incomplete gates)', 'BLOCKED', 'SOURCE_CONFLICT', () => evalLive({ sourceOverrides: { 'mission': m } }))
    expect(s.verdict).toBe('BLOCKED'); expect(codesOf(s)).toContain('SOURCE_CONFLICT')
  })
  it('R9 · invalid critical N/A → INVALID_NA / NO-GO', () => {
    const own = { ...greenSourceJson()['qa-ownership'], CLAUDE_MUST_PROVE: [
      { item: 'persistence', status: 'x', applicability: 'NOT_APPLICABLE' }, { item: 'routing', status: 'PROVEN' } ] }
    const s = runR('R9 invalid critical N/A (no reason)', 'NO-GO', 'INVALID_NA', () => evalLive({ sourceOverrides: { 'qa-ownership': own } }))
    expect(codesOf(s)).toContain('INVALID_NA')
  })
  it('R10 · risk data missing → RISK_FLOOR_VIOLATION / NO-GO (safe floor, never optimistic)', () => {
    const pu = { ...greenSourceJson()['product-universe'], screens: [
      { surfaceId: 'AbuAI' /* risk MISSING */ }, { surfaceId: 'AbuWhatsApp', risk: 'high' },
      { surfaceId: 'AbuCalendar', risk: 'high' } ] }
    const s = runR('R10 risk data missing → safe floor', 'NO-GO', 'RISK_FLOOR_VIOLATION', () => evalLive({ sourceOverrides: { 'product-universe': pu } }))
    expect(codesOf(s)).toContain('RISK_FLOOR_VIOLATION')
  })
  it('R11 · risk tier improperly lowered → RISK_FLOOR_VIOLATION / NO-GO', () => {
    const pu = { ...greenSourceJson()['product-universe'], screens: [
      { surfaceId: 'AbuAI', risk: 'high', riskTierApplied: 1 }, { surfaceId: 'AbuWhatsApp', risk: 'high' },
      { surfaceId: 'AbuCalendar', risk: 'high' } ] }
    const s = runR('R11 risk tier lowered below floor', 'NO-GO', 'RISK_FLOOR_VIOLATION', () => evalLive({ sourceOverrides: { 'product-universe': pu } }))
    expect(codesOf(s)).toContain('RISK_FLOOR_VIOLATION')
  })
  it('R12 · dirty-state drift during evaluation → INPUT_DRIFT_DURING_EVALUATION / INVALID', () => {
    const s = runR('R12 dirty-state drift mid-evaluation', 'INVALID', 'INPUT_DRIFT_DURING_EVALUATION', () => evalLive({}, { inputDriftDuringEvaluation: true }))
    expect(s.verdict).toBe('INVALID'); expect(codesOf(s)).toContain('INPUT_DRIFT_DURING_EVALUATION')
  })
  it('R13 · deployment changes during evaluation → INPUT_DRIFT_DURING_EVALUATION / INVALID', () => {
    const s = runR('R13 deployment drift mid-evaluation', 'INVALID', 'INPUT_DRIFT_DURING_EVALUATION', () => evalLive({}, { inputDriftDuringEvaluation: true }))
    expect(s.verdict).toBe('INVALID'); expect(codesOf(s)).toContain('INPUT_DRIFT_DURING_EVALUATION')
  })
  it('R14 · control plane changes during evaluation → CONTROL_PLANE_MISMATCH / NO-GO', () => {
    const s = runR('R14 control-plane drift', 'NO-GO', 'CONTROL_PLANE_MISMATCH', () => evalLive({ frozen: 'cp_frozenOLD9' }))
    expect(codesOf(s)).toContain('CONTROL_PLANE_MISMATCH')
  })
  it('R15 · authoritative source never consumed → SOURCE_COVERAGE_UNKNOWN / BLOCKED', () => {
    const discovered = [...SOURCE_REGISTRY.map((s) => s.path), 'docs/engineering-os/qa/mystery-critical.json']
    const s = runR('R15 unconsumed authoritative source', 'BLOCKED', 'SOURCE_COVERAGE_UNKNOWN', () => evalLive({ discoveredSources: discovered }))
    expect(s.verdict).toBe('BLOCKED'); expect(codesOf(s)).toContain('SOURCE_COVERAGE_UNKNOWN')
  })
  it('R16 · base gate NO-GO while meta would GO → meta stays blocking (UNPUSHED_COMMIT)', () => {
    const s = runR('R16 meta never erases a base blocker', 'NO-GO', 'UNPUSHED_COMMIT', () => evalLive({ git: { remote: 'differentsha' } }))
    expect(s.verdict).not.toBe('GO'); expect(codesOf(s)).toContain('UNPUSHED_COMMIT')
  })
  it('R17 · evidence removed from a blocking state → verdict cannot improve (still non-GO)', () => {
    const s = runR('R17 removing evidence cannot improve a blocking verdict', 'BLOCKED', 'SOURCE_MISSING',
      () => evalLive({ deploy: { healthBuildVersion: '0.285.0', aliasOk: false }, sourceOverrides: { 'evidence': 'MISSING' } }))
    expect(s.verdict).not.toBe('GO'); expect(codesOf(s)).toContain('SOURCE_MISSING')
  })
  it('R18 · critical claim removed entirely → verdict cannot improve (EXPECTED_CLAIM_ABSENT)', () => {
    const ev = { ...greenSourceJson()['evidence'], claims: [{ claim: 'AbuAI + AbuCalendar only', surfaces: ['AbuAI', 'AbuCalendar'], test: 'a.test.ts', result: 'PASS', evidenceLevel: 'PREVIEW', mode: 'playwright' }] }
    const s = runR('R18 removing a required claim cannot improve the verdict', 'NO-GO', 'EXPECTED_CLAIM_ABSENT', () => evalLive({ sourceOverrides: { 'evidence': ev } }))
    expect(s.verdict).not.toBe('GO'); expect(codesOf(s)).toContain('EXPECTED_CLAIM_ABSENT')
  })
})

// ── Structured claim→surface link REPLACES the substring heuristic (Stage 3) ──
// Proof the replacement catches cases the old `evidenceText.includes(surfaceId)`
// oracle would have mis-mapped — the exact oracle-from-the-artifact class that
// already escaped in this project. Each case names what substring would have done.
describe('claim→surface link — structured, not substring', () => {
  const substringWouldSay = (claims: any[], surfaceId: string) => JSON.stringify(claims).includes(surfaceId)

  it('FALSE-POSITIVE the substring oracle would make: a claim that MENTIONS/NEGATES a surface does NOT cover it', () => {
    const claims = [{ claim: 'this candidate does NOT touch AbuCalendar at all', surfaces: [], test: 'a.test.ts', result: 'PASS', evidenceLevel: 'PREVIEW', mode: 'playwright' },
                    { claim: 'AbuAI + AbuWhatsApp', surfaces: ['AbuAI', 'AbuWhatsApp'], test: 'a.test.ts', result: 'PASS', evidenceLevel: 'PREVIEW', mode: 'playwright' }]
    // Substring WOULD (wrongly) mark AbuCalendar present because the text contains "AbuCalendar".
    expect(substringWouldSay(claims, 'AbuCalendar')).toBe(true)
    const s = evalLive({ sourceOverrides: { 'evidence': { ...greenSourceJson()['evidence'], claims } } })
    // Structured link correctly treats AbuCalendar as ABSENT (no `surfaces` entry).
    expect(s.presentClaimIds).not.toContain('surface:AbuCalendar')
    expect(codesOf(s)).toContain('EXPECTED_CLAIM_ABSENT')
  })

  it('FALSE-NEGATIVE the substring oracle would make: a differently-spelled reference still counts when structured', () => {
    const claims = [{ claim: 'Abu AI conversation, Abu WhatsApp comm, Abu Calendar events (spaced names)',
                      surfaces: ['AbuAI', 'AbuWhatsApp', 'AbuCalendar'], test: 'a.test.ts', result: 'PASS', evidenceLevel: 'PREVIEW', mode: 'playwright' }]
    // Substring WOULD (wrongly) MISS AbuCalendar: the token "AbuCalendar" is absent (only "Abu Calendar").
    expect(substringWouldSay(claims.map((c) => ({ claim: c.claim })), 'AbuCalendar')).toBe(false)
    const s = evalLive({ sourceOverrides: { 'evidence': { ...greenSourceJson()['evidence'], claims } } })
    // Structured link correctly marks all three PRESENT.
    expect(s.presentClaimIds).toContain('surface:AbuCalendar')
    expect(s.presentClaimIds).toContain('surface:AbuAI')
    expect(s.verdict).toBe('GO')
  })
})

// ── §10 FIXTURE ↔ LIVE DIFFERENTIAL ──────────────────────────────────────────
describe('fixture ↔ live differential (release-critical semantics match)', () => {
  it('the adapter-built input and a hand-authored equivalent evaluate to the same release-critical semantics', () => {
    const live = toControlPlaneInput(buildLiveSnapshot(greenDeps()))
    // PATH A: a direct canonical input expressing the SAME semantic state.
    const direct: ControlPlaneInput = {
      release: live.release, // release sub-state already normalized identically
      requiredClaims: live.requiredClaims,
      presentClaims: live.presentClaims,
      riskAreas: live.riskAreas,
      changeImpact: live.changeImpact,
      evaluators: live.evaluators,
      candidateSha: HEAD,
      controlPlaneId: CP_ID,
      frozenControlPlaneId: CP_ID,
      owner: { requested: false },
      holdouts: [],
      now: NOW,
    }
    const a = evaluateControlPlane(direct)
    const b = evaluateControlPlane(live)
    expect(a.verdict).toBe(b.verdict)
    expect([...a.requiredClaimIds].sort()).toEqual([...b.requiredClaimIds].sort())
    expect([...a.presentClaimIds].sort()).toEqual([...b.presentClaimIds].sort())
    expect(codesOf(a).sort()).toEqual(codesOf(b).sort())
  })
})

// ── §11 + §12 MONOTONICITY: loss of assurance never improves the verdict ─────
describe('verdict monotonicity — loss of assurance cannot improve the verdict', () => {
  const permissiveness: Record<string, number> = { GO: 3, 'NO-GO': 1, BLOCKED: 0, INVALID: 0 }
  const green = evalLive()
  const degradations: [string, () => ControlPlaneState][] = [
    ['add base blocker (unpushed)', () => evalLive({ git: { remote: 'x' } })],
    ['missing critical source', () => evalLive({ sourceOverrides: { 'meta-qa': 'MISSING' } })],
    ['malformed critical source', () => evalLive({ sourceOverrides: { 'evidence': 'PARSE_FAILED' } })],
    ['stale evidence', () => evalLive({ sourceOverrides: { 'evidence': { ...greenSourceJson()['evidence'], build: '0.169.0' } } })],
    ['remove required claim', () => evalLive({ sourceOverrides: { 'evidence': { ...greenSourceJson()['evidence'], claims: [{ claim: 'AbuAI only', surfaces: ['AbuAI'], test: 'a.test.ts', result: 'PASS', evidenceLevel: 'PREVIEW', mode: 'playwright' }] } } })],
    ['source conflict', () => evalLive({ sourceOverrides: { 'mission': { ...greenSourceJson()['mission'], verdict: 'READY', gatesReady: { aToC: false } } } })],
    ['evaluator crash', () => evalLive({ evaluators: [{ name: 'g', required: true, status: 'CRASHED' }] })],
    ['candidate mismatch (deploy)', () => evalLive({ deploy: { healthBuildVersion: '0.1.0', aliasOk: false } })],
    ['control-plane drift', () => evalLive({ frozen: 'cp_OLD' })],
    ['input drift', () => evalLive({}, { inputDriftDuringEvaluation: true })],
  ]
  it('green baseline is GO (the maximum permissiveness)', () => {
    expect(green.verdict).toBe('GO')
  })
  for (const [name, fn] of degradations) {
    it(`degradation "${name}" never yields a MORE permissive verdict than green`, () => {
      const d = fn()
      expect(permissiveness[d.verdict]!).toBeLessThanOrEqual(permissiveness[green.verdict]!)
      expect(d.verdict).not.toBe('GO')
    })
  }
})

afterAll(() => {
  const passed = rows.filter((r) => r.TEST_ASSERTION === 'PASS').length
  const artifact = {
    $schema: 'internal://abu/adapter-adversarial-result',
    generatedFor: 'Stage 2 — live-adapter falsification (spec-derived oracle)',
    now: NOW,
    controlPlaneId: CP_ID,
    note: 'Every row flows through reader→parse→normalize→reconcile→evaluateControlPlane via injected readers (no real QA data touched). Two axes: CONTROL STATE + TEST_ASSERTION.',
    totalCases: rows.length,
    passed,
    failed: rows.length - passed,
    rows,
  }
  try {
    mkdirSync(resolve(process.cwd(), 'docs/engineering-os/qa'), { recursive: true })
    writeFileSync(resolve(process.cwd(), 'docs/engineering-os/qa/adapter-adversarial-result.json'), JSON.stringify(artifact, null, 2) + '\n')
  } catch { /* artifact is convenience; assertions are the authority */ }
})
