/*
 * qa-monster.mjs — ONE canonical Monster QA orchestrator. (Track B / B1 + B13)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/qa-monster.mjs rc         <rcUrl>     # certify a Preview RC candidate
 *   node scripts/qa-monster.mjs production <prodUrl>   # verify actual Production (read-only)
 *   node scripts/qa-monster.mjs feature                # fast local gates (typecheck + targeted tests)
 *
 * This is the repository-owned entry point a FRESH session uses to certify a candidate WITHOUT this
 * conversation. It does NOT re-implement any acceptance logic — it RUNS the already-frozen, calibrated
 * scripts and unit gates, collects their machine artifacts, and emits ONE authoritative machine state
 * (docs/eval/QA_MONSTER_REPORT.json). Human prose is generated FROM this state; prose cannot promote a
 * machine NO-GO. Deterministic non-zero exit when release criteria fail.
 *
 * Canonical mechanisms it invokes (read, not recreated):
 *   deterministic gates : tsc --noEmit ; vitest (full or targeted)
 *   deployed acceptance : rc-acceptance-{calendar,whatsapp,temporal,replacement-paths}.mjs,
 *                         rc-acceptance-tool-sequencing.mjs, rc-acceptance-historical-corpus.mjs
 *   security authority  : scan-deployed-secrets.ts (calibrated; explicit target; fail-closed)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [mode, url] = [process.argv[2], process.argv[3]]
if (!mode || !['rc', 'production', 'feature'].includes(mode)) {
  console.error('usage: node scripts/qa-monster.mjs <feature|rc|production> [url]'); process.exit(2)
}
if ((mode === 'rc' || mode === 'production') && !/^https?:\/\//.test(url || '')) {
  console.error(`mode ${mode} requires an explicit http(s) URL`); process.exit(2)
}

const areas = []
const t0 = Date.now()
// Run a step; capture pass/exit + optional result JSON. A step's own script is the source of truth.
function step(area, cmd, { json, evidence } = {}) {
  const start = Date.now()
  let exit = 0, out = ''
  try { out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 900_000 }) }
  catch (e) { exit = e.status ?? 1; out = `${e.stdout ?? ''}${e.stderr ?? ''}` }
  let detail = null
  if (json && existsSync(resolve(json))) { try { detail = JSON.parse(readFileSync(resolve(json), 'utf8')) } catch {} }
  const pass = exit === 0
  areas.push({ area, cmd, pass, exit, evidence: evidence ?? 'CODE', ms: Date.now() - start,
    verdict: detail?.verdict ?? detail?.score ?? (pass ? 'PASS' : 'FAIL'),
    resultFile: json ?? null,
    tail: out.trim().split('\n').slice(-3).join(' | ').slice(0, 300) })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${area.padEnd(26)} exit=${exit}  ${(Date.now() - start)}ms`)
  return pass
}

console.log(`=== QA MONSTER · mode=${mode}${url ? ' · ' + url : ''} ===\n`)

if (mode === 'feature') {
  step('typecheck', 'npm run typecheck')
  step('unit-suite', 'npx vitest run')
}

if (mode === 'rc' || mode === 'production') {
  // Deterministic gates first (fast, cache-friendly) — a red gate blocks before spending provider calls.
  step('typecheck', 'npm run typecheck')
  step('unit-suite', 'npx vitest run')
  // Deployed acceptance (PREVIEW/PRODUCTION evidence) — reuse the frozen scripts.
  step('security-scan', `npx tsx scripts/scan-deployed-secrets.ts ${url}`, { json: 'docs/engineering-os/qa/deployed-secret-exposure.json', evidence: mode === 'production' ? 'PRODUCTION' : 'PREVIEW' })
  step('calendar', `node scripts/rc-acceptance-calendar.mjs ${url}`, { json: 'docs/eval/RC_ACCEPTANCE_CALENDAR.json', evidence: 'PREVIEW' })
  step('whatsapp', `npx tsx scripts/rc-acceptance-whatsapp.mjs ${url}`, { json: 'docs/eval/RC_ACCEPTANCE_WHATSAPP.json', evidence: 'PREVIEW' })
  step('current-info-freshness', `npx tsx scripts/rc-acceptance-temporal.mjs ${url}`, { json: 'docs/eval/RC_ACCEPTANCE_TEMPORAL.json', evidence: 'PREVIEW' })
  step('replacement-paths', `node scripts/rc-acceptance-replacement-paths.mjs ${url}`, { json: 'docs/eval/RC_ACCEPTANCE_REPLACEMENT_PATHS.json', evidence: 'PREVIEW' })
  step('tool-sequencing', 'npx tsx scripts/rc-acceptance-tool-sequencing.mjs', { json: 'docs/eval/RC_ACCEPTANCE_TOOL_SEQUENCING.json', evidence: 'CODE+golden' })
  step('historical-corpus', `node scripts/rc-acceptance-historical-corpus.mjs ${url}`, { json: 'docs/eval/RC_HISTORICAL_CORPUS.json', evidence: 'PREVIEW' })
}

const corpus = existsSync(resolve('docs/eval/RC_HISTORICAL_CORPUS.json')) ? JSON.parse(readFileSync(resolve('docs/eval/RC_HISTORICAL_CORPUS.json'), 'utf8')) : null
const git = (cmd, fallback = null) => { try { return execSync(cmd, { encoding: 'utf8' }).trim() } catch { return fallback } }

// ── Integrity #2 · SPLIT runtime identity from harness identity ──────────────────────────────────
// RUNTIME_SOURCE_SHA = last commit touching a NON-TEST runtime path (what the deployed bundle is built
// from). CERTIFICATION_HARNESS_SHA = HEAD (the evaluator that produced THIS evidence). They differ when
// test/config/doc-only commits land after a deploy — valid, but never conflate them.
const HARNESS_SHA = git('git rev-parse HEAD')
const RUNTIME_SOURCE_SHA = git("git log -1 --format=%h -- api/*.ts \":(exclude)api/*.test.ts\" src/services src/screens \":(exclude)**/*.test.ts\" \":(exclude)**/*.test.tsx\"")
const CONTROL_PLANE_VERSION = (() => { try { return JSON.parse(readFileSync(resolve('docs/engineering-os/qa/control-plane-identity.json'), 'utf8')).controlPlaneId } catch { return null } })()
let DEPLOYED_BUILD_ID = null
if (url) { try { DEPLOYED_BUILD_ID = JSON.parse(execSync(`curl -s ${url}/api/health`, { encoding: 'utf8' })).buildVersion } catch {} }

// ── Integrity #1 · deterministic worktree certification ──────────────────────────────────────────
// Classify the dirty worktree: any uncommitted NON-TEST runtime file (api/** or src/** runtime) is a
// release-contamination BLOCKER; generated/docs/test churn is not. Certification requires zero dirty
// runtime files at the certified SHA.
const dirty = (git('git status --short', '') || '').split('\n').filter(Boolean).map((l) => l.slice(3))
const dirtyRuntime = dirty.filter((f) => /^(api\/|src\/)/.test(f) && !/\.test\.(ts|tsx)$/.test(f) && !/^src\/(eval|.*\/diagnostics)\//.test(f))
const WORKTREE_RUNTIME_CLEAN = dirtyRuntime.length === 0

const productAreas = areas.filter((a) => ['security-scan', 'calendar', 'whatsapp', 'current-info-freshness', 'replacement-paths', 'tool-sequencing', 'historical-corpus'].includes(a.area))
const qaGateAreas = areas.filter((a) => ['typecheck', 'unit-suite'].includes(a.area))
const pass = areas.every((a) => a.pass)

// ── Integrity #5 · SPLIT the verdicts (never let one GO imply more than its denominator proves) ──
// Productization floor: B1 done; B2–B13 pending (updated as they land). QA_SYSTEM is READY only when the
// gates pass AND the runtime worktree is clean AND productization is complete.
const PRODUCTIZATION = { B1_orchestrator: 'DONE', B2_B13: 'PENDING' }
const PRODUCT_CANDIDATE_VERDICT = (mode === 'feature') ? 'N/A' : (productAreas.length > 0 && productAreas.every((a) => a.pass) && (corpus?.score?.STILL_OPEN ?? 1) === 0 ? 'GO' : 'NO_GO')
const QA_SYSTEM_VERDICT = (qaGateAreas.every((a) => a.pass) && WORKTREE_RUNTIME_CLEAN)
  ? (PRODUCTIZATION.B2_B13 === 'DONE' ? 'READY' : 'INCOMPLETE_PRODUCTIZATION')
  : 'NOT_READY'
const RELEASE_PROMOTION_VERDICT = (PRODUCT_CANDIDATE_VERDICT === 'GO' && QA_SYSTEM_VERDICT === 'READY') ? 'ELIGIBLE_PENDING_OWNER' : 'NOT_YET'

const report = {
  $schema: 'internal://abu/qa-monster', mode, target: url ?? null, when: new Date().toISOString(),
  identity: {
    RUNTIME_SOURCE_SHA, CERTIFICATION_HARNESS_SHA: HARNESS_SHA, EVIDENCE_GENERATION_SHA: HARNESS_SHA,
    DEPLOYED_BUILD_ID, DEPLOYED_ARTIFACT_HOST: url ? new URL(url).host : null, CONTROL_PLANE_VERSION,
    note: 'RUNTIME_SOURCE_SHA is the last non-test runtime commit (the deployed bundle source); the harness SHA is HEAD. Test/config/doc commits after a deploy change the evaluator identity, not the runtime.',
  },
  worktree: { dirtyTotal: dirty.length, dirtyRuntime, WORKTREE_RUNTIME_CLEAN },
  verdicts: { PRODUCT_CANDIDATE_VERDICT, QA_SYSTEM_VERDICT, RELEASE_PROMOTION_VERDICT, productizationFloor: PRODUCTIZATION },
  verdict: pass ? 'GO' : 'NO_GO', // legacy area-level roll-up (kept for back-compat; see verdicts.* for release semantics)
  counts: {
    areas: areas.length, pass: areas.filter((a) => a.pass).length, fail: areas.filter((a) => !a.pass).length,
    AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO: corpus?.score?.STILL_OPEN ?? null,
  },
  areas,
  note: 'Machine state is authoritative. Prose is generated FROM this and cannot promote a NO_GO / NOT_YET. A green area roll-up is NOT release promotion — see verdicts.RELEASE_PROMOTION_VERDICT. Production deploy + old-credential revocation are OWNER actions.',
  runtimeMs: Date.now() - t0,
}
writeFileSync(resolve('docs/eval/QA_MONSTER_REPORT.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`\n=== areas ${report.counts.pass}/${report.counts.areas} · PRODUCT=${PRODUCT_CANDIDATE_VERDICT} · QA_SYSTEM=${QA_SYSTEM_VERDICT} · RELEASE=${RELEASE_PROMOTION_VERDICT} · ${Math.round(report.runtimeMs / 1000)}s ===`)
console.log(`identity: runtime=${RUNTIME_SOURCE_SHA} harness=${HARNESS_SHA?.slice(0, 8)} build=${DEPLOYED_BUILD_ID} · worktree runtime-clean=${WORKTREE_RUNTIME_CLEAN}`)
console.log('wrote docs/eval/QA_MONSTER_REPORT.json')
process.exit(pass ? 0 : 1)
