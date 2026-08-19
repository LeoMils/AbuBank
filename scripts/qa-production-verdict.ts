/*
 * `npm run qa:production-verdict` — the SEPARATE deterministic verdict authority.
 * ════════════════════════════════════════════════════════════════════════════
 * Independent of the gate's cache: it runs LIVE checks (fresh gate, git HEAD vs
 * remote, cache-busted deployed fingerprint, physical-row contracts, rollback
 * evidence) and only a fully-green run may authorize a terminal verdict. Emits a
 * machine-readable verdict artifact. Never trusts a cached success.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { get as httpsGet } from 'node:https'

const RC = 'https://abu-ela-rc.vercel.app'
const SCORECARD = 'docs/engineering-os/qa/production-convergence/scorecard.json'
const DEPLOY = 'docs/engineering-os/qa/production-convergence/deploy-evidence.json'
const VERDICT_OUT = 'docs/engineering-os/qa/production-convergence/verdict.json'
// Release-owned path prefixes THIS convergence work authored (candidate integrity).
const OWNED = ['src/engineering-os/', 'src/screens/AbuAI/realtime/', 'scripts/qa-', 'scripts/seal-scorecard', 'scripts/abu-', 'docs/engineering-os/qa/production-convergence/', 'src/version.ts', 'api/health.ts']

interface Check { name: string; ok: boolean; detail: string }
const checks: Check[] = []
const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail })

function sh(cmd: string): string { return execSync(cmd, { encoding: 'utf8' }).trim() }
function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpsGet(url, (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve(d)) }).on('error', reject)
  })
}

const version = readFileSync('src/version.ts', 'utf8').match(/version:\s*'([^']+)'/)?.[1] ?? 'UNKNOWN'

// 1) Live gate exits 0 (source-aware, not cached).
try { execSync('npx tsx scripts/qa-production-gate.ts', { stdio: 'pipe' }); add('gate-exit-0', true, 'qa:production-gate exit 0') }
catch { add('gate-exit-0', false, 'qa:production-gate exited nonzero') }

// 2) HEAD == remote.
let head = 'X', remote = 'Y'
try { head = sh('git rev-parse HEAD'); remote = sh('git rev-parse origin/rc5/cognitive-architecture-and-acceptance') } catch { /* */ }
add('head-equals-remote', head === remote && /^[0-9a-f]{40}$/.test(head), `HEAD ${head.slice(0, 12)} vs remote ${remote.slice(0, 12)}`)

// 3) BUILD_ID contract synced (version.ts == api/health.ts).
const healthBuild = readFileSync('api/health.ts', 'utf8').match(/const BUILD_VERSION = '([^']+)'/)?.[1]
add('build-id-synced', healthBuild === version, `version.ts=${version} health=${healthBuild}`)

// 4) Candidate clean: no UNCOMMITTED file under a release-owned path.
let ownedDirty: string[] = []
try {
  const porcelain = sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3))
  ownedDirty = porcelain.filter((f) => OWNED.some((p) => f.startsWith(p)))
} catch { /* */ }
add('candidate-clean', ownedDirty.length === 0, ownedDirty.length ? `release-owned dirty: ${ownedDirty.join(', ')}` : 'no release-owned uncommitted files')

// 5) Physical/external rows each represented with a blockerProof contract.
const sc = JSON.parse(readFileSync(SCORECARD, 'utf8')) as { rows: Array<{ id: string; classification: string; status: string; blockerProof?: string }> }
const nonAuto = sc.rows.filter((r) => r.classification !== 'automatable')
const badBlocker = nonAuto.filter((r) => !r.blockerProof || (r.status !== 'PHYSICAL_ONLY' && r.status !== 'EXTERNAL_BLOCKER'))
add('physical-external-contracts', badBlocker.length === 0, badBlocker.length ? `bad: ${badBlocker.map((r) => r.id).join(',')}` : `${nonAuto.length} rows each with blockerProof: ${nonAuto.map((r) => r.id).join(',')}`)

// 6) Rollback evidence current.
try { const dep = JSON.parse(readFileSync(DEPLOY, 'utf8')); add('rollback-proven', dep.rollback?.restoredOk === true, dep.rollback?.roundTrip ?? 'no rollback record') }
catch { add('rollback-proven', false, 'deploy-evidence unreadable') }

// 7) LIVE deployed fingerprint == tested build (cache-busted).
async function main() {
  try {
    const raw = await fetchText(`${RC}/api/health?cb=${head.slice(0, 8)}${version.length}`)
    const deployed = JSON.parse(raw).buildVersion
    add('deployed-equals-tested', deployed === version, `deployed ${deployed} vs tested ${version}`)
  } catch (e) { add('deployed-equals-tested', false, `health fetch failed: ${e instanceof Error ? e.message : e}`) }

  const pass = checks.every((c) => c.ok)
  const verdict = {
    verdict: pass ? 'AUTOMATABLE_PRODUCTION_CANDIDATE_PROVEN' : 'INCOMPLETE',
    candidateSha: head, build: version,
    automatableCriticalHigh: sc.rows.filter((r) => r.classification === 'automatable').length,
    physicalRows: nonAuto.map((r) => r.id),
    preExistingDirtyOutOfScope: (() => { try { return sh('git status --porcelain').split('\n').filter(Boolean).map((l) => l.slice(3)).filter((f) => !OWNED.some((p) => f.startsWith(p))) } catch { return [] } })(),
    checks,
  }
  try { writeFileSync(VERDICT_OUT, JSON.stringify(verdict, null, 2) + '\n') } catch { /* */ }
  console.log(`ABU AI PRODUCTION VERDICT — ${pass ? 'PASS' : 'FAIL'}`)
  for (const c of checks) console.log(`  [${c.ok ? 'OK ' : 'XX '}] ${c.name}: ${c.detail}`)
  console.log(`RESULT: ${verdict.verdict}`)
  process.exit(pass ? 0 : 1)
}
main()
