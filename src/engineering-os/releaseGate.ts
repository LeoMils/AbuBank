/*
 * GATE D — RELEASE CONTROLLER (pure evaluator).
 *
 * evaluateRelease(state) is the single source of RC truth. It is PURE (all real
 * state is injected) so it can be unit-tested against deliberate mutations — a
 * release controller that cannot itself be falsified is worthless. The CLI
 * (scripts/rc-verify.ts) gathers the real git/deploy/fs/test state and calls this.
 *
 * One red blocker => NOT READY. No narrative exception.
 */

export interface ReleaseBlocker { code: string; reason: string }

export interface EvidenceClaim {
  claim: string
  test: string                 // "path/to/file.test.ts" or "... :: describe"
  result: string               // 'PASS' | 'FAIL' | 'PARTIAL' | ...
  evidenceLevel: string        // CODE | MOCK | BROWSER | PREVIEW | PHYSICAL_DEVICE | PRODUCTION
  mode?: string
}

export interface ReleaseState {
  /** Every CLAUDE_MUST_PROVE acceptance item + its status. */
  claudeMustProve: { item: string; status: string }[]
  /** Statuses that count as complete (green). Anything else blocks. */
  doneStatuses: string[]
  evidenceClaims: EvidenceClaim[]
  genome: { failureId: string; regressionTest: string }[]
  metaMutation: { invariant: string; caughtBy: string }[]
  blindSpots: { defectClass: string; status: string; automatable: boolean }[]
  git: { head: string; remote: string | null; dirtyRuntime: string[] }
  deploy: { healthBuildVersion: string | null; expectedBuildVersion: string; aliasOk: boolean }
  /** Injected fs + suite oracles (real in the CLI, stubbed in tests). */
  testFileExists: (path: string) => boolean
  suiteResult: (path: string) => 'pass' | 'fail' | 'skipped' | 'unknown'
  requiredSuites: string[]
  gates: {
    aToC: boolean
    realProviderMatrix: boolean
    enlargedText: boolean
    privacyScan: 'pass' | 'fail'
  }
  codeArtifactCommitsDiffer: boolean
  commitsDocOnlyClassified: boolean
  /** Whole-product coverage (Product Universe + Master Matrix). */
  productUniversePresent: boolean
  masterMatrixPresent: boolean
  /** Critical journeys/surfaces with NO mapped evidence (block READY). */
  criticalCoverageGaps: string[]
}

/** Extract the file path portion of a test reference ("a.test.ts :: x" -> "a.test.ts"). */
export function testPathOf(ref: string): string {
  return String(ref || '').split('::')[0]!.trim().split(/\s+\(/)[0]!.trim()
}

const BROWSER_MODE_RE = /playwright|chromium|webkit|browser|persistent[- ]?profile|elementFromPoint/i

export function evaluateRelease(s: ReleaseState): { ready: boolean; blockers: ReleaseBlocker[] } {
  const b: ReleaseBlocker[] = []
  const add = (code: string, reason: string) => b.push({ code, reason })
  const done = new Set(s.doneStatuses)

  // 1. every CLAUDE_MUST_PROVE item complete
  for (const it of s.claudeMustProve) {
    if (!done.has(it.status)) add('CLAUDE_MUST_PROVE_INCOMPLETE', `${it.item} = ${it.status}`)
  }
  // 2. required suite skipped
  for (const suite of s.requiredSuites) {
    if (s.suiteResult(suite) === 'skipped') add('REQUIRED_SUITE_SKIPPED', suite)
  }
  // 3 + 4. evidence references a missing test / result conflicts with actual output
  for (const c of s.evidenceClaims) {
    const path = testPathOf(c.test)
    if (path && !path.startsWith('n/a') && !s.testFileExists(path)) {
      add('EVIDENCE_TEST_MISSING', `${c.claim} -> ${path}`)
    } else if (path && /pass/i.test(c.result) && s.suiteResult(path) === 'fail') {
      add('EVIDENCE_RESULT_CONFLICT', `${c.claim} claims ${c.result} but ${path} FAILS`)
    }
    // 17. no PHYSICAL claim from browser automation
    if (c.evidenceLevel === 'PHYSICAL_DEVICE' && BROWSER_MODE_RE.test(c.mode || '')) {
      add('FALSE_PHYSICAL_CLAIM', `${c.claim} claims PHYSICAL_DEVICE from ${c.mode}`)
    }
  }
  // 5. tested commit pushed
  if (s.git.remote === null || s.git.head !== s.git.remote) {
    add('UNPUSHED_COMMIT', `head ${s.git.head} != remote ${s.git.remote}`)
  }
  // 6. uncommitted runtime changes
  if (s.git.dirtyRuntime.length > 0) add('UNCOMMITTED_RUNTIME', s.git.dirtyRuntime.join(', '))
  // 7 + 9. deployed fingerprint / build version == tested
  if (s.deploy.healthBuildVersion !== s.deploy.expectedBuildVersion) {
    add('FINGERPRINT_MISMATCH', `health ${s.deploy.healthBuildVersion} != tested ${s.deploy.expectedBuildVersion}`)
  }
  // 8. stable alias points to the tested deployment
  if (!s.deploy.aliasOk) add('ALIAS_MISMATCH', 'stable alias does not point to the tested deployment')
  // 10. genome regression exists
  for (const g of s.genome) {
    const p = testPathOf(g.regressionTest)
    if (!p || !s.testFileExists(p)) add('GENOME_REGRESSION_MISSING', `${g.failureId} -> ${g.regressionTest}`)
  }
  // 11. every registered mutant references an existing test
  for (const m of s.metaMutation) {
    const p = testPathOf(m.caughtBy)
    if (!p || !s.testFileExists(p)) add('MUTANT_NOT_DETECTED', `${m.invariant} -> ${m.caughtBy}`)
  }
  // 12. unresolved critical automatable blind spot
  for (const bs of s.blindSpots) {
    if (bs.automatable && /unresolved|pending|open/i.test(bs.status)) {
      add('UNRESOLVED_BLIND_SPOT', bs.defectClass)
    }
  }
  // 13. privacy scan
  if (s.gates.privacyScan === 'fail') add('PRIVACY_SCAN_FAILED', 'phone-token privacy scan failed')
  // 14 / 15 / 16. lifecycle + provider + enlarged-text gates
  if (!s.gates.aToC) add('ATOC_LIFECYCLE_MISSING', 'A->B->C multi-deploy proof missing')
  if (!s.gates.realProviderMatrix) add('PROVIDER_MATRIX_INCOMPLETE', 'real-provider failure matrix incomplete')
  if (!s.gates.enlargedText) add('ENLARGED_TEXT_INCOMPLETE', 'enlarged-text reachability incomplete')
  // 18. code/artifact commit divergence without doc-only classification
  if (s.codeArtifactCommitsDiffer && !s.commitsDocOnlyClassified) {
    add('COMMIT_CLASSIFICATION_MISSING', 'code vs artifact commits differ without a verified docs-only classification')
  }
  // 19. whole-product coverage: universe + matrix present, no critical gap
  if (!s.productUniversePresent) add('PRODUCT_UNIVERSE_MISSING', 'docs/engineering-os/qa/product-universe.json missing')
  if (!s.masterMatrixPresent) add('MASTER_MATRIX_MISSING', 'docs/engineering-os/qa/master-matrix.json missing')
  for (const g of s.criticalCoverageGaps) add('CRITICAL_COVERAGE_GAP', g)

  return { ready: b.length === 0, blockers: b }
}
