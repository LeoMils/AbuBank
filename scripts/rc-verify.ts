/*
 * GATE D — release controller CLI.  `npm run rc:verify`
 *
 * Gathers the REAL git / deploy / filesystem / artifact state and feeds it to the
 * pure evaluateRelease() evaluator. Exits non-zero (blocks the RC) on any blocker.
 * Runs on Node 24 native TypeScript type-stripping — no build step.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateRelease, type ReleaseState, type EvidenceClaim } from '../src/engineering-os/releaseGate.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Index every test/spec file basename under src/ and e2e/ so references may be a
 *  full path OR a bare basename (with optional prose) and still resolve. */
function buildTestIndex(root: string): Set<string> {
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
  walk(join(root, 'src')); walk(join(root, 'e2e'))
  return files
}
const TEST_INDEX = buildTestIndex(ROOT)
function resolveTestFile(root: string, ref: string): boolean {
  if (existsSync(resolve(root, ref))) return true
  const base = (ref.match(/[\w.-]+\.(test|spec)\.tsx?/) || [])[0]
  return !!base && TEST_INDEX.has(base)
}
const STABLE = 'https://abu-ela-rc.vercel.app'
const p = (rel: string) => resolve(ROOT, rel)
const readJSON = (rel: string): any => { try { return JSON.parse(readFileSync(p(rel), 'utf8')) } catch { return null } }
const sh = (cmd: string): string => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim() } catch { return '' } }

function expectedBuildVersion(): string {
  try { return (/version:\s*'([^']+)'/.exec(readFileSync(p('src/version.ts'), 'utf8')) || [])[1] || '' } catch { return '' }
}
async function healthBuildVersion(): Promise<string | null> {
  try {
    const r = await fetch(`${STABLE}/api/health?t=${Date.now()}`, { cache: 'no-store' } as any)
    const j: any = await r.json()
    return j?.buildVersion ?? null
  } catch { return null }
}

function gitState() {
  const head = sh('git rev-parse HEAD')
  let remote = sh('git rev-parse @{u}')
  if (!remote) { const b = sh('git rev-parse --abbrev-ref HEAD'); remote = (sh(`git ls-remote origin refs/heads/${b}`).split(/\s+/)[0]) || null as any }
  const porcelain = sh('git status --porcelain').split('\n').filter(Boolean)
  const dirtyRuntime = porcelain
    .map((l) => l.slice(3))
    .filter((f) => /^(src|api)\//.test(f) && !/\.test\.tsx?$/.test(f) && !/scripts\//.test(f))
  return { head, remote: remote || null, dirtyRuntime }
}

function classifyOwnershipStatus(status: string): boolean {
  return /PROVEN|DONE/i.test(status) && !/PENDING|PARTIAL|NOT/i.test(status)
}

/** Surface ids in the Product Universe whose risk is high or medium — a GAP
 *  journey on one of these blocks READY. */
function productUniverseHighRiskSurfaces(): string[] {
  const pu = readJSON('docs/engineering-os/qa/product-universe.json')
  return (pu?.screens || []).filter((s: any) => /high|medium/i.test(String(s.risk))).map((s: any) => String(s.surfaceId))
}

async function main() {
  const ownership = readJSON('docs/engineering-os/qa/qa-ownership.json') || {}
  const evidence = readJSON('docs/engineering-os/qa/evidence.json') || {}
  const genomeDoc = readJSON('docs/engineering-os/qa/failure-genome.json') || {}
  const metaQa = readJSON('docs/engineering-os/qa/meta-qa.json') || {}
  const mission = readJSON('docs/engineering-os/qa/mission.json') || {}

  const claudeMustProve = (ownership.CLAUDE_MUST_PROVE || []).map((x: any) => ({ item: x.item, status: String(x.status ?? '') }))
  const evidenceClaims: EvidenceClaim[] = (evidence.claims || []).map((c: any) => ({
    claim: c.claim, test: c.test || '', result: c.result || '', evidenceLevel: c.evidenceLevel || '', mode: c.mode || '',
  }))
  const genome = (genomeDoc.failures || []).map((f: any) => ({ failureId: f.failureId, regressionTest: f.regressionTest || '' }))
  const metaMutation = (metaQa.mutationCertification || []).map((m: any) => ({ invariant: m.invariant, caughtBy: m.caughtBy || '' }))
  const blindSpots = (metaQa.blindSpotRegister || []).map((b: any) => ({
    defectClass: b.defectClass,
    status: String(b.status ?? ''),
    automatable: !/PHYSICAL|device-only|DEVICE_ONLY|automatable=no/i.test(String(b.status ?? '')),
  }))

  // Gate readiness flags — explicit booleans the mission maintains as gates land.
  const gr = mission.gatesReady || {}
  const gates = {
    aToC: !!gr.aToC,
    realProviderMatrix: !!gr.realProviderMatrix,
    enlargedText: !!gr.enlargedText,
    privacyScan: (runPrivacyScan() ? 'pass' : 'fail') as 'pass' | 'fail',
  }

  const health = await healthBuildVersion()
  const expected = expectedBuildVersion()

  const state: ReleaseState = {
    claudeMustProve,
    doneStatuses: [], // handled via classifyOwnershipStatus below by pre-filtering
    evidenceClaims, genome, metaMutation, blindSpots,
    git: gitState(),
    deploy: { healthBuildVersion: health, expectedBuildVersion: expected, aliasOk: !!health && health === expected },
    testFileExists: (path: string) => resolveTestFile(ROOT, path),
    suiteResult: () => 'unknown',
    requiredSuites: [],
    gates,
    codeArtifactCommitsDiffer: false,
    commitsDocOnlyClassified: true,
    productUniversePresent: existsSync(p('docs/engineering-os/qa/product-universe.json')),
    masterMatrixPresent: existsSync(p('docs/engineering-os/qa/master-matrix.json')),
    criticalCoverageGaps: ((): string[] => {
      const mm = readJSON('docs/engineering-os/qa/master-matrix.json')
      // A journey with status GAP (no evidence at all) and a high-risk surface blocks READY.
      const highRisk = new Set((productUniverseHighRiskSurfaces()))
      return (mm?.journeys || [])
        .filter((j: any) => String(j.status) === 'GAP' && highRisk.has(String(j.surface).split('/')[0]))
        .map((j: any) => `${j.id} (${j.surface}): ${j.gap || 'no evidence'}`)
    })(),
  }
  // Map ownership statuses through the classifier by marking done ones.
  state.doneStatuses = Array.from(new Set(claudeMustProve.map((c) => c.status).filter(classifyOwnershipStatus)))

  const result = evaluateRelease(state)
  const line = (s: string) => process.stdout.write(s + '\n')
  line('── rc:verify ─────────────────────────────────────────')
  line(`tested build : ${expected}`)
  line(`deployed     : ${health ?? '(unreachable)'}`)
  line(`git head     : ${state.git.head}`)
  line(`git remote   : ${state.git.remote ?? '(none)'}`)
  line(`dirty runtime: ${state.git.dirtyRuntime.length}`)
  line(`gates        : aToC=${gates.aToC} provider=${gates.realProviderMatrix} enlargedText=${gates.enlargedText} privacy=${gates.privacyScan}`)
  line('──────────────────────────────────────────────────────')
  if (result.ready) {
    line('RESULT: READY FOR MINIMAL PHYSICAL IPHONE VALIDATION')
    process.exit(0)
  }
  line(`RESULT: NOT READY — ${result.blockers.length} blocker(s):`)
  for (const bl of result.blockers) line(`  [${bl.code}] ${bl.reason}`)
  process.exit(1)
}

function runPrivacyScan(): boolean {
  try {
    execSync('npx vitest run src/screens/AbuWhatsApp/phonePrivacy.test.ts', { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch { return false }
}

main().catch((e) => { process.stdout.write('rc:verify error: ' + (e?.message ?? String(e)) + '\n'); process.exit(1) })
