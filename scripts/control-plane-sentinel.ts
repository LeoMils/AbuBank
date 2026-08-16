/*
 * CONTROL-PLANE CI SENTINEL.  (Stage 2 §21)
 * ═════════════════════════════════════════
 * Proves the enforcement contract: a control-plane REFUSAL propagates to a
 * NON-ZERO process exit, so a CI/release job recognizes failure. Uses a safe,
 * SYNTHETIC, in-memory blocking scenario (a missing critical source) through the
 * REAL evaluate path — it never touches product runtime or real QA data, and is
 * flag-free (off unless invoked). This is a CI probe, NOT a release-decision
 * mechanism, so it is intentionally outside CONTROL_PLANE_IDENTITY.
 *
 *   npx tsx scripts/control-plane-sentinel.ts
 *
 * Exit: 0 = contract holds (refusal → nonzero mapping proven).
 *       2 = contract BROKEN (a refusal did not map to a nonzero exit) — CI must fail.
 */
import { buildLiveSnapshot, toControlPlaneInput, type LiveDeps, type SourceReadResult } from '../src/engineering-os/liveSnapshot.ts'
import { evaluateControlPlane } from '../src/engineering-os/releaseControlPlane.ts'

const NOW = '2026-01-01T00:00:00.000Z'

// A synthetic reader: everything VALID except a MISSING critical source (meta-qa).
const reader = (rel: string): SourceReadResult => {
  if (rel.endsWith('meta-qa.json')) return { status: 'MISSING' }
  if (rel.endsWith('qa-ownership.json')) return { status: 'VALID', json: { $schema: 'internal://abu/qa-ownership', build: '9.9.9', CLAUDE_MUST_PROVE: [{ item: 'x', status: 'PROVEN' }] }, declaredBuild: '9.9.9', schema: 'internal://abu/qa-ownership' }
  if (rel.endsWith('evidence.json')) return { status: 'VALID', json: { $schema: 'internal://abu/evidence', build: '9.9.9', claims: [] }, declaredBuild: '9.9.9', schema: 'internal://abu/evidence' }
  if (rel.endsWith('failure-genome.json')) return { status: 'VALID', json: { build: '9.9.9', failures: [] }, declaredBuild: '9.9.9' }
  if (rel.endsWith('mission.json')) return { status: 'VALID', json: { build: '9.9.9', gatesReady: {} }, declaredBuild: '9.9.9' }
  if (rel.endsWith('product-universe.json')) return { status: 'VALID', json: { $schema: 'internal://abu/product-universe', build: '9.9.9', screens: [] }, declaredBuild: '9.9.9', schema: 'internal://abu/product-universe' }
  if (rel.endsWith('master-matrix.json')) return { status: 'VALID', json: { build: '9.9.9', journeys: [] }, declaredBuild: '9.9.9' }
  return { status: 'MISSING' }
}

const deps: LiveDeps = {
  readSource: reader,
  git: { head: 'sentinel', remote: 'sentinel', dirtyRuntime: [], dirtyStateHash: 'x' },
  deploy: { healthBuildVersion: '9.9.9', expectedBuildVersion: '9.9.9', aliasOk: true },
  candidateBuild: '9.9.9',
  controlPlaneId: 'cp_sentinel',
  frozenControlPlaneId: 'cp_sentinel',
  now: NOW,
  changedFiles: [],
  moduleOwnership: {},
  testFileExists: () => true,
  suiteResult: () => 'pass',
  privacyScanPass: true,
  evaluatorStatuses: [{ name: 'x', required: true, status: 'OK' }],
  ownerRequested: false,
  discoveredSources: [],
}

const result = evaluateControlPlane(toControlPlaneInput(buildLiveSnapshot(deps)))
// The enforcement mapping the CLI uses: verdict !== 'GO' → exit code 1 (nonzero).
const mappedExit = result.verdict === 'GO' ? 0 : 1
const line = (s: string) => process.stdout.write(s + '\n')
line('── control-plane CI sentinel ──────────────────────────')
line(`synthetic verdict : ${result.verdict}`)
line(`mapped exit code  : ${mappedExit}`)
if (result.verdict !== 'GO' && mappedExit !== 0) {
  line('SENTINEL OK: a refusal maps to a NON-ZERO exit — CI will recognize the failure.')
  process.exit(0)
}
line('SENTINEL BROKEN: a refusal did NOT produce a non-zero exit — enforcement contract violated.')
process.exit(2)
