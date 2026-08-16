/*
 * CONTROL_PLANE_IDENTITY — compute / freeze / verify.  (Section 3 + 11)
 * ════════════════════════════════════════════════════════════════════
 * The control plane must be able to name itself. This hashes the release-critical
 * components and derives a stable identity via the SAME FNV-1a the runtime module
 * uses (imported, not re-implemented — no drift). Evidence produced under one
 * identity may not silently certify another.
 *
 * Usage (TS-importing → run via tsx, the repo convention for scripts/*.ts):
 *   npx tsx scripts/control-plane-identity.ts            # compute + compare to frozen
 *   npx tsx scripts/control-plane-identity.ts --freeze   # freeze IFF eligible
 *
 * Freeze eligibility (Section 11): the control plane may be frozen only AFTER
 * adversarial validation succeeded — i.e. the adversarial artifact exists with
 * failed === 0 and totalCases > 0. Freezing an unvalidated control plane is refused.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeControlPlaneIdentity } from '../src/engineering-os/releaseControlPlane.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (rel) => resolve(ROOT, rel)

// The release-critical component set. Changing ANY of these changes the identity.
const COMPONENTS = {
  releaseGate: 'src/engineering-os/releaseGate.ts',
  releaseControlPlane: 'src/engineering-os/releaseControlPlane.ts',
  evidenceSchema: 'src/engineering-os/evidence.ts',
  productionGate: 'src/engineering-os/productionGate.ts',
  rcVerifyCli: 'scripts/rc-verify.ts',
  adversarialSuite: 'src/engineering-os/releaseControlPlane.adversarial.test.ts',
  releaseGateTest: 'src/engineering-os/releaseGate.test.ts',
  // Stage 2: the LIVE-STATE ADAPTER and its CLI are release-critical from now on —
  // a verdict is only as trustworthy as the adapter feeding it (§2).
  liveSnapshotAdapter: 'src/engineering-os/liveSnapshot.ts',
  liveVerdictCli: 'scripts/control-plane-live.ts',
  adapterAdversarialSuite: 'src/engineering-os/liveSnapshot.adversarial.test.ts',
  // Stage 3C: control-completeness is release-critical — it decides whether the
  // control model itself is complete enough to certify anything.
  controlCompleteness: 'src/engineering-os/controlCompleteness.ts',
  controlCompletenessSuite: 'src/engineering-os/controlCompleteness.test.ts',
  // Stage 3C: obligation-first (negative-space) completeness + execution-continuity gate.
  obligationCompleteness: 'src/engineering-os/obligationCompleteness.ts',
  obligationCompletenessSuite: 'src/engineering-os/obligationCompleteness.test.ts',
  executionState: 'src/engineering-os/executionState.ts',
  executionStateSuite: 'src/engineering-os/executionState.test.ts',
  // Stage 3C §1: the YIELD GATE — CONTINUE_MACHINE_WORK is not permission to yield.
  yieldGate: 'src/engineering-os/yieldGate.ts',
  yieldGateSuite: 'src/engineering-os/yieldGate.test.ts',
  // Stage 3C §3–4: capability-discovery SOURCE-COMPLETENESS oracle (prerequisite for o-capability).
  capabilityDiscoverySource: 'src/engineering-os/capabilityDiscoverySource.ts',
  capabilityDiscoverySourceSuite: 'src/engineering-os/capabilityDiscoverySource.test.ts',
  // Stage 3C §10: non-collapsible CLAIM-STATE model (o-claimstate).
  claimState: 'src/engineering-os/claimState.ts',
  claimStateSuite: 'src/engineering-os/claimState.test.ts',
  // Stage 3C §4–5: static↔dynamic reachability reconciliation core (o-capability dynamic).
  dynamicReachability: 'src/engineering-os/dynamicReachability.ts',
  dynamicReachabilitySuite: 'src/engineering-os/dynamicReachability.test.ts',
  // P0 incident gate: scan the shipped bundle for a billable key (o-privacy prerequisite).
  bundleSecretScan: 'src/engineering-os/bundleSecretScan.ts',
  bundleSecretScanSuite: 'src/engineering-os/bundleSecretScan.test.ts',
  // Stage 3C resume: context-stop honesty, constitution calibration, capability universe.
  contextExecutionState: 'src/engineering-os/contextExecutionState.ts',
  contextExecutionStateSuite: 'src/engineering-os/contextExecutionState.test.ts',
  constitutionCoverage: 'src/engineering-os/constitutionCoverage.ts',
  constitutionCoverageSuite: 'src/engineering-os/constitutionCoverage.test.ts',
  capabilityManifest: 'src/engineering-os/capabilityManifest.ts',
  capabilityManifestSuite: 'src/engineering-os/capabilityManifest.test.ts',
}
// Freeze requires BOTH adversarial suites to have passed (Stage 1 gate + Stage 2 adapter).
const ADVERSARIAL_ARTIFACTS = [
  'docs/engineering-os/qa/control-plane-adversarial-result.json',
  'docs/engineering-os/qa/adapter-adversarial-result.json',
]
const FROZEN = 'docs/engineering-os/qa/control-plane-identity.json'

function sha256(rel) {
  return createHash('sha256').update(readFileSync(p(rel))).digest('hex').slice(0, 16)
}

function componentHashes() {
  const out = {}
  for (const [name, rel] of Object.entries(COMPONENTS)) {
    out[name] = existsSync(p(rel)) ? sha256(rel) : 'MISSING'
  }
  return out
}

function adversarialEligible() {
  let totalPassed = 0, totalCases = 0
  for (const art of ADVERSARIAL_ARTIFACTS) {
    if (!existsSync(p(art))) return { ok: false, why: `adversarial artifact absent: ${art}` }
    try {
      const a = JSON.parse(readFileSync(p(art), 'utf8'))
      if (!(a.totalCases > 0)) return { ok: false, why: `${art} has no cases` }
      if (a.failed !== 0) return { ok: false, why: `${art} reports ${a.failed} failed case(s)` }
      totalPassed += a.passed; totalCases += a.totalCases
    } catch (e) {
      return { ok: false, why: `${art} unreadable: ${e?.message ?? e}` }
    }
  }
  return { ok: true, why: `${totalPassed}/${totalCases} adversarial cases passed across ${ADVERSARIAL_ARTIFACTS.length} suites` }
}

const hashes = componentHashes()
const identity = computeControlPlaneIdentity(hashes)
const missing = Object.entries(hashes).filter(([, h]) => h === 'MISSING').map(([n]) => n)

const line = (s) => process.stdout.write(s + '\n')
line('── control-plane identity ─────────────────────────────')
line(`identity : ${identity}`)
for (const [n, h] of Object.entries(hashes)) line(`  ${n.padEnd(20)} ${h}`)
if (missing.length) line(`WARN missing components: ${missing.join(', ')}`)

const doFreeze = process.argv.includes('--freeze')

if (doFreeze) {
  const elig = adversarialEligible()
  if (missing.length) {
    line(`REFUSED freeze: missing release-critical component(s): ${missing.join(', ')}`)
    process.exit(1)
  }
  if (!elig.ok) {
    line(`REFUSED freeze: ${elig.why} — control plane must pass adversarial validation before it can be frozen (Section 11).`)
    process.exit(1)
  }
  const record = {
    $schema: 'internal://abu/control-plane-identity',
    controlPlaneId: identity,
    frozenAt: new Date().toISOString(),
    eligibility: elig.why,
    components: COMPONENTS,
    componentHashes: hashes,
    note: 'Evidence produced under a DIFFERENT controlPlaneId may not silently certify this one. A change to any component changes the id and expires affected certification.',
  }
  writeFileSync(p(FROZEN), JSON.stringify(record, null, 2) + '\n')
  line(`FROZEN → ${FROZEN}  (${elig.why})`)
  process.exit(0)
}

// Default: compare to a prior freeze if present (drift detection).
if (existsSync(p(FROZEN))) {
  const prev = JSON.parse(readFileSync(p(FROZEN), 'utf8'))
  if (prev.controlPlaneId === identity) {
    line(`MATCH: current identity equals frozen ${prev.controlPlaneId} (frozen ${prev.frozenAt}).`)
    process.exit(0)
  }
  line(`DRIFT: current ${identity} != frozen ${prev.controlPlaneId} — affected certification is EXPIRED.`)
  process.exit(1)
}
line('no frozen identity yet — run with --freeze once adversarial validation passes.')
process.exit(0)
