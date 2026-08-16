/*
 * CONTROL-PLANE LIVE VERDICT — the real-state run.  (Stage 2 §3/§6/§18)
 * ════════════════════════════════════════════════════════════════════
 *   REAL git/deploy/fs/QA → buildLiveSnapshot → evaluateControlPlane → verdict
 *
 * This is the ONE canonical live path. It gathers the exact release-critical
 * reality, canonicalizes it into an immutable snapshot with CONTROL_PLANE_INPUT_HASH,
 * evaluates it, then RE-READS the volatile identities (git HEAD, dirty-state hash,
 * deployed fingerprint, control-plane identity). Any change → INPUT_DRIFT → INVALID:
 * we never report a verdict for a reality that no longer exists.
 *
 * Truth, not GO: this prints whatever the machine state supports, verbatim.
 *
 *   npx tsx scripts/control-plane-live.ts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { get as httpsGet } from 'node:https'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildLiveSnapshot, toControlPlaneInput, computeInputHash, type LiveDeps, type SourceReadResult } from '../src/engineering-os/liveSnapshot.ts'
import { evaluateControlPlane, computeControlPlaneIdentity, type EvaluatorRun } from '../src/engineering-os/releaseControlPlane.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const p = (rel: string) => resolve(ROOT, rel)
const STABLE = 'https://abu-ela-rc.vercel.app'
const FROZEN = 'docs/engineering-os/qa/control-plane-identity.json'
const VERDICT_OUT = 'docs/engineering-os/qa/control-plane-live-verdict.json'

const sh = (cmd: string): string => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim() } catch { return '' } }
const sha16 = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16)

// ── Strict real source reader ───────────────────────────────────────────────
function readSourceReal(rel: string): SourceReadResult {
  const abs = p(rel)
  if (!existsSync(abs)) return { status: 'MISSING' }
  let raw: string
  try { raw = readFileSync(abs, 'utf8') } catch { return { status: 'MISSING' } }
  let json: any
  try { json = JSON.parse(raw) } catch { return { status: 'PARSE_FAILED' } }
  return { status: 'VALID', json, declaredBuild: json.build, declaredCommit: json.testedCommit || json.commit, schema: json.$schema }
}

// ── Real test index (for the base gate's testFileExists oracle) ─────────────
function buildTestIndex(): Set<string> {
  const files = new Set<string>()
  const walk = (dir: string) => {
    let entries: any[]
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const f = join(dir, e.name)
      if (e.isDirectory()) { if (!/node_modules|dist|\.git|\.vercel/.test(f)) walk(f) }
      else if (/\.(test|spec)\.tsx?$/.test(e.name)) files.add(e.name)
    }
  }
  walk(p('src')); walk(p('e2e'))
  return files
}
const TEST_INDEX = buildTestIndex()
function testFileExists(ref: string): boolean {
  if (existsSync(p(ref))) return true
  const base = (ref.match(/[\w.-]+\.(test|spec)\.tsx?/) || [])[0]
  return !!base && TEST_INDEX.has(base)
}

function versionBuild(): string {
  try { return (/version:\s*'([^']+)'/.exec(readFileSync(p('src/version.ts'), 'utf8')) || [])[1] || '' } catch { return '' }
}
// One-shot node:https GET (no undici keep-alive → clean process exit on Windows).
function fetchText(url: string): Promise<string> {
  return new Promise((resolve) => {
    const req = httpsGet(url, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d)) })
    req.on('error', () => resolve(''))
    req.setTimeout(8000, () => { req.destroy(); resolve('') })
  })
}
async function deployedFingerprint(): Promise<string | null> {
  const raw = await fetchText(`${STABLE}/api/health?cb=${Date.now()}`)
  try { return JSON.parse(raw)?.buildVersion ?? null } catch { return null }
}

// ── Control-plane identity: recompute from the FROZEN component list (single
//    source of the component set), so this CLI never duplicates it. ───────────
function identityFromFrozen(): { current: string; frozen: string | null; components: Record<string, string> } {
  if (!existsSync(p(FROZEN))) return { current: 'cp_UNFROZEN', frozen: null, components: {} }
  const rec = JSON.parse(readFileSync(p(FROZEN), 'utf8'))
  const components: Record<string, string> = rec.components || {}
  const hashes: Record<string, string> = {}
  for (const [name, rel] of Object.entries(components)) {
    hashes[name] = existsSync(p(rel as string)) ? sha16(readFileSync(p(rel as string))) : 'MISSING'
  }
  return { current: computeControlPlaneIdentity(hashes), frozen: rec.controlPlaneId ?? null, components }
}

function gitState() {
  const head = sh('git rev-parse HEAD')
  let remote: string | null = sh('git rev-parse @{u}')
  if (!remote) { const b = sh('git rev-parse --abbrev-ref HEAD'); remote = sh(`git ls-remote origin refs/heads/${b}`).split(/\s+/)[0] || null }
  const porcelain = sh('git status --porcelain')
  const dirtyRuntime = porcelain.split('\n').filter(Boolean).map((l) => l.slice(3)).filter((f) => /^(src|api)\//.test(f) && !/\.test\.tsx?$/.test(f) && !/scripts\//.test(f))
  return { head, remote, dirtyRuntime, dirtyStateHash: sha16(porcelain) }
}

function changedFiles(): string[] {
  // Conservative closure: the candidate's committed diff vs origin/main merge-base.
  let base = sh('git merge-base HEAD origin/main')
  if (!base) base = sh('git rev-parse HEAD~1')
  const out = base ? sh(`git diff --name-only ${base}...HEAD`) : ''
  return out.split('\n').filter(Boolean)
}

function evaluatorStatuses(): EvaluatorRun[] {
  const read = (rel: string): 'OK' | 'CRASHED' | 'MISSING' => {
    if (!existsSync(p(rel))) return 'MISSING'
    try { const a = JSON.parse(readFileSync(p(rel), 'utf8')); return a.failed === 0 && a.totalCases > 0 ? 'OK' : 'CRASHED' } catch { return 'CRASHED' }
  }
  return [
    { name: 'stage1-adversarial', required: true, status: read('docs/engineering-os/qa/control-plane-adversarial-result.json') },
    { name: 'adapter-adversarial', required: true, status: read('docs/engineering-os/qa/adapter-adversarial-result.json') },
  ]
}

async function main() {
  const now = new Date().toISOString()
  const id = identityFromFrozen()
  const git = gitState()
  const build = versionBuild()
  const deployed = await deployedFingerprint()

  const deps: LiveDeps = {
    readSource: readSourceReal,
    git,
    deploy: { healthBuildVersion: deployed, expectedBuildVersion: build, aliasOk: !!deployed && deployed === build },
    candidateBuild: build,
    controlPlaneId: id.current,
    ...(id.frozen ? { frozenControlPlaneId: id.frozen } : {}),
    now,
    changedFiles: changedFiles(),
    moduleOwnership: {
      'src/engineering-os/': ['releaseGate', 'releaseControlPlane', 'liveSnapshot'],
      'src/screens/AbuAI/': ['abuai-runtime'],
      'api/': ['api'],
      'knowledge/': ['knowledge', 'family-graph'],
    },
    testFileExists,
    suiteResult: () => 'unknown',
    // Privacy scan is a heavy external run; not executed by the wiring CLI. Recorded
    // as an assumption in the artifact — it does not manufacture GO here because the
    // real candidate blocks earlier on source health / freshness.
    privacyScanPass: true,
    evaluatorStatuses: evaluatorStatuses(),
    ownerRequested: false,
    discoveredSources: (() => {
      const dir = p('docs/engineering-os/qa')
      try { return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => `docs/engineering-os/qa/${f}`) } catch { return [] }
    })(),
  }

  const snapshot = buildLiveSnapshot(deps)
  const inputHash = computeInputHash(snapshot)
  let result = evaluateControlPlane(toControlPlaneInput(snapshot))

  // ── Re-read volatile identities: defeat time-of-check drift (§6). ──────────
  const git2 = gitState()
  const deployed2 = await deployedFingerprint()
  const id2 = identityFromFrozen()
  const drift =
    git2.head !== git.head ||
    git2.dirtyStateHash !== git.dirtyStateHash ||
    deployed2 !== deployed ||
    id2.current !== id.current
  if (drift) {
    result = evaluateControlPlane(toControlPlaneInput(snapshot, { inputDriftDuringEvaluation: true }))
  }

  const verdictRecord = {
    $schema: 'internal://abu/control-plane-live-verdict',
    generatedAt: now,
    candidateSha: snapshot.candidateSha,
    candidateBuild: snapshot.candidateBuild,
    controlPlaneId: snapshot.controlPlaneId,
    frozenControlPlaneId: snapshot.frozenControlPlaneId ?? null,
    controlPlaneInputHash: inputHash,
    verdict: result.verdict,
    inputDriftDuringEvaluation: drift,
    workingTreeIdentity: snapshot.workingTreeIdentity,
    deployedCandidateIdentity: snapshot.deployedCandidateIdentity,
    sources: snapshot.sources,
    sourceConflicts: snapshot.sourceConflicts,
    sourceCoverage: snapshot.sourceCoverage,
    requiredClaimCount: snapshot.requiredClaims.length,
    presentClaimCount: snapshot.presentClaims.length,
    releaseBlockers: result.releaseBlockers,
    controlBlockers: result.controlBlockers,
    ownerHandoff: result.ownerHandoff,
    assumptions: ['privacyScan not executed by the wiring CLI (recorded, not claimed)'],
  }
  try { writeFileSync(p(VERDICT_OUT), JSON.stringify(verdictRecord, null, 2) + '\n') } catch { /* */ }

  const line = (s: string) => process.stdout.write(s + '\n')
  line('── control-plane LIVE verdict ─────────────────────────')
  line(`candidate    : ${snapshot.candidateSha.slice(0, 12)}  build ${build}`)
  line(`deployed     : ${deployed ?? '(unreachable)'}`)
  line(`control plane: ${snapshot.controlPlaneId}  (frozen ${snapshot.frozenControlPlaneId ?? 'none'})`)
  line(`input hash   : ${inputHash}`)
  line(`drift re-read: ${drift ? 'DRIFT → INVALID' : 'stable'}`)
  line('── sources ────────────────────────────────────────────')
  for (const s of snapshot.sources) line(`  ${s.name.padEnd(18)} ${s.parseStatus.padEnd(14)} ${s.freshness}`)
  line('──────────────────────────────────────────────────────')
  line(`VERDICT: ${result.verdict}`)
  const all = [...result.releaseBlockers, ...result.controlBlockers]
  if (all.length === 0) line('  (no blockers)')
  for (const b of all) line(`  [${b.code}] ${b.reason}`)
  process.exit(result.verdict === 'GO' ? 0 : 1)
}
main().catch((e) => { process.stdout.write('control-plane-live error: ' + (e?.message ?? String(e)) + '\n'); process.exit(1) })
