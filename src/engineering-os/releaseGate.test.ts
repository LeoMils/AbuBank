/*
 * GATE D — the release controller must itself be falsifiable. A fully-green state
 * is READY; every deliberate mutation must produce the matching blocker; and an
 * empty/degenerate state must fail-closed (never accidentally READY).
 */
import { describe, it, expect } from 'vitest'
import { evaluateRelease, testPathOf, type ReleaseState } from './releaseGate'

const EXISTING = new Set([
  'a.test.ts', 'b.test.ts', 'genome.test.ts', 'mutant.test.ts',
])

/** A fully-green baseline that must evaluate READY. */
function greenState(): ReleaseState {
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
    deploy: { healthBuildVersion: '0.168.0', expectedBuildVersion: '0.168.0', aliasOk: true },
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

const codesFor = (mutate: (s: ReleaseState) => void) => {
  const s = greenState(); mutate(s)
  return evaluateRelease(s).blockers.map((x) => x.code)
}

describe('release controller — green baseline', () => {
  it('a fully-green state is READY', () => {
    const r = evaluateRelease(greenState())
    expect(r.ready, JSON.stringify(r.blockers)).toBe(true)
    expect(r.blockers).toEqual([])
  })
})

describe('release controller — every deliberate mutation is caught', () => {
  it('incomplete CLAUDE_MUST_PROVE item', () => {
    expect(codesFor((s) => { s.claudeMustProve[0]!.status = 'PARTIAL' })).toContain('CLAUDE_MUST_PROVE_INCOMPLETE')
  })
  it('skipped required suite', () => {
    expect(codesFor((s) => { s.suiteResult = (p) => (p === 'a.test.ts' ? 'skipped' : 'pass') })).toContain('REQUIRED_SUITE_SKIPPED')
  })
  it('evidence references a missing test', () => {
    expect(codesFor((s) => { s.evidenceClaims[0]!.test = 'ghost.test.ts' })).toContain('EVIDENCE_TEST_MISSING')
  })
  it('evidence PASS conflicts with an actual FAIL', () => {
    expect(codesFor((s) => { s.suiteResult = (p) => (p === 'a.test.ts' ? 'fail' : 'pass') })).toContain('EVIDENCE_RESULT_CONFLICT')
  })
  it('unpushed commit', () => {
    expect(codesFor((s) => { s.git.remote = 'different' })).toContain('UNPUSHED_COMMIT')
  })
  it('uncommitted runtime change', () => {
    expect(codesFor((s) => { s.git.dirtyRuntime = ['src/x.ts'] })).toContain('UNCOMMITTED_RUNTIME')
  })
  it('deployed fingerprint mismatch', () => {
    expect(codesFor((s) => { s.deploy.healthBuildVersion = '0.167.0' })).toContain('FINGERPRINT_MISMATCH')
  })
  it('stable alias mismatch', () => {
    expect(codesFor((s) => { s.deploy.aliasOk = false })).toContain('ALIAS_MISMATCH')
  })
  it('genome regression missing', () => {
    expect(codesFor((s) => { s.genome[0]!.regressionTest = 'gone.test.ts' })).toContain('GENOME_REGRESSION_MISSING')
  })
  it('required mutant not detected', () => {
    expect(codesFor((s) => { s.metaMutation[0]!.caughtBy = 'gone.test.ts' })).toContain('MUTANT_NOT_DETECTED')
  })
  it('unresolved automatable blind spot', () => {
    expect(codesFor((s) => { s.blindSpots.push({ defectClass: 'sw-stale', status: 'UNRESOLVED', automatable: true }) })).toContain('UNRESOLVED_BLIND_SPOT')
  })
  it('privacy scan failed', () => {
    expect(codesFor((s) => { s.gates.privacyScan = 'fail' })).toContain('PRIVACY_SCAN_FAILED')
  })
  it('A->B->C lifecycle missing', () => {
    expect(codesFor((s) => { s.gates.aToC = false })).toContain('ATOC_LIFECYCLE_MISSING')
  })
  it('provider matrix incomplete', () => {
    expect(codesFor((s) => { s.gates.realProviderMatrix = false })).toContain('PROVIDER_MATRIX_INCOMPLETE')
  })
  it('enlarged-text incomplete', () => {
    expect(codesFor((s) => { s.gates.enlargedText = false })).toContain('ENLARGED_TEXT_INCOMPLETE')
  })
  it('PHYSICAL claimed from browser automation', () => {
    expect(codesFor((s) => { s.evidenceClaims[0]!.evidenceLevel = 'PHYSICAL_DEVICE' })).toContain('FALSE_PHYSICAL_CLAIM')
  })
  it('code/artifact commit divergence without a docs-only classification', () => {
    expect(codesFor((s) => { s.codeArtifactCommitsDiffer = true })).toContain('COMMIT_CLASSIFICATION_MISSING')
  })
  it('product universe missing', () => {
    expect(codesFor((s) => { s.productUniversePresent = false })).toContain('PRODUCT_UNIVERSE_MISSING')
  })
  it('master matrix missing', () => {
    expect(codesFor((s) => { s.masterMatrixPresent = false })).toContain('MASTER_MATRIX_MISSING')
  })
  it('a critical coverage gap blocks READY', () => {
    expect(codesFor((s) => { s.criticalCoverageGaps = ['J18-weather has no tests'] })).toContain('CRITICAL_COVERAGE_GAP')
  })
})

describe('release controller — fails closed', () => {
  it('a degenerate empty state is NOT ready', () => {
    const empty: ReleaseState = {
      claudeMustProve: [], doneStatuses: [], evidenceClaims: [], genome: [], metaMutation: [],
      blindSpots: [], git: { head: 'x', remote: null, dirtyRuntime: [] },
      deploy: { healthBuildVersion: null, expectedBuildVersion: '0.168.0', aliasOk: false },
      testFileExists: () => false, suiteResult: () => 'unknown', requiredSuites: [],
      gates: { aToC: false, realProviderMatrix: false, enlargedText: false, privacyScan: 'pass' },
      codeArtifactCommitsDiffer: false, commitsDocOnlyClassified: false,
      productUniversePresent: false, masterMatrixPresent: false, criticalCoverageGaps: [],
    }
    expect(evaluateRelease(empty).ready).toBe(false)
  })
  it('testPathOf strips describe suffixes and trailing notes', () => {
    expect(testPathOf('x.test.ts :: describe > it')).toBe('x.test.ts')
    expect(testPathOf('x.test.ts (real path)')).toBe('x.test.ts')
  })
})
