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
import { deriveExit, EXIT } from './qa-monster-verdict.mjs'

const [mode, url] = [process.argv[2], process.argv[3]]
if (!mode || !['rc', 'production', 'feature'].includes(mode)) {
  console.error('usage: node scripts/qa-monster.mjs <feature|rc|production> [url]'); process.exit(EXIT.USAGE)
}
if ((mode === 'rc' || mode === 'production') && !/^https?:\/\//.test(url || '')) {
  console.error(`mode ${mode} requires an explicit http(s) URL`); process.exit(EXIT.USAGE)
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
  // evidencePresent: an area that declares a json result must have produced a readable one. When it
  // claims pass but the evidence did not materialize, the integrity scan flags pass-by-omission.
  const evidencePresent = json ? detail !== null : true
  areas.push({ area, cmd, pass, exit, evidence: evidence ?? 'CODE', ms: Date.now() - start,
    verdict: detail?.verdict ?? detail?.score ?? (pass ? 'PASS' : 'FAIL'),
    resultFile: json ?? null, evidencePresent,
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

const pass = areas.every((a) => a.pass) // legacy area-level roll-up (back-compat field only)

// ── Integrity #3 + #5 · mode-aware, fail-closed exit contract (one shared code path) ─────────────
// Verdicts and the process exit code are BOTH derived from scripts/qa-monster-verdict.mjs — the same
// pure module the self-mutation test (src/engineering-os/qaMonsterExitContract.test.ts) exercises.
// Productization floor: B1 done; B2–B13 pending (flip productizationComplete when they land).
const PRODUCTIZATION = { B1_orchestrator: 'DONE', B2_B13: 'PENDING' }
const productizationComplete = PRODUCTIZATION.B2_B13 === 'DONE'
const corpusStillOpen = corpus?.score?.STILL_OPEN ?? null
const decision = deriveExit({ mode, areas, corpusStillOpen, worktreeRuntimeClean: WORKTREE_RUNTIME_CLEAN, productizationComplete })
const { PRODUCT_CANDIDATE_VERDICT, QA_SYSTEM_VERDICT, RELEASE_PROMOTION_VERDICT } = decision.verdicts
  ?? { PRODUCT_CANDIDATE_VERDICT: 'NOT_PROVEN', QA_SYSTEM_VERDICT: 'NOT_READY', RELEASE_PROMOTION_VERDICT: 'BLOCKED' }

// ── B2 · QA economy (MEASURED, this run) ─────────────────────────────────────────────────────────
// Timings come from the areas we just ran — no invented monetary SLO (owner sets spend). Deterministic
// gates vs network/provider-touching acceptance are split so a tier's cost profile is legible. A tier
// exceeding a *configured* wall-clock target is a QA-system finding, never a reason to drop assurance.
const NETWORK_AREAS = ['security-scan', 'calendar', 'whatsapp', 'current-info-freshness', 'replacement-paths', 'historical-corpus']
const economy = {
  tier: mode,
  wallClockMs: Date.now() - t0,
  deterministicMs: areas.filter((a) => !NETWORK_AREAS.includes(a.area)).reduce((s, a) => s + a.ms, 0),
  networkMs: areas.filter((a) => NETWORK_AREAS.includes(a.area)).reduce((s, a) => s + a.ms, 0),
  networkAreaCount: areas.filter((a) => NETWORK_AREAS.includes(a.area)).length,
  perAreaMs: Object.fromEntries(areas.map((a) => [a.area, a.ms])),
  note: 'MEASURED wall-clock/area timings from THIS run. No monetary SLO is asserted (OWNER sets spend). Wall-clock targets are configurable; a tier over target is a QA-system finding, not a license to reduce assurance.',
}

const report = {
  $schema: 'internal://abu/qa-monster', mode, target: url ?? null, when: new Date().toISOString(),
  identity: {
    RUNTIME_SOURCE_SHA, CERTIFICATION_HARNESS_SHA: HARNESS_SHA, EVIDENCE_GENERATION_SHA: HARNESS_SHA,
    DEPLOYED_BUILD_ID, DEPLOYED_ARTIFACT_HOST: url ? new URL(url).host : null, CONTROL_PLANE_VERSION,
    note: 'RUNTIME_SOURCE_SHA is the last non-test runtime commit (the deployed bundle source); the harness SHA is HEAD. Test/config/doc commits after a deploy change the evaluator identity, not the runtime.',
  },
  worktree: { dirtyTotal: dirty.length, dirtyRuntime, WORKTREE_RUNTIME_CLEAN },
  verdicts: { PRODUCT_CANDIDATE_VERDICT, QA_SYSTEM_VERDICT, RELEASE_PROMOTION_VERDICT, productizationFloor: PRODUCTIZATION },
  exit: { code: decision.code, state: decision.state, reason: decision.reason,
    machineClosableUnknown: decision.machineClosableUnknown, machineClosableRemaining: decision.machineClosableRemaining },
  verdict: pass ? 'GO' : 'NO_GO', // legacy area-level roll-up (kept for back-compat; see verdicts.* + exit.* for release semantics)
  counts: {
    areas: areas.length, pass: areas.filter((a) => a.pass).length, fail: areas.filter((a) => !a.pass).length,
    AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO: corpus?.score?.STILL_OPEN ?? null,
  },
  areas,
  economy,
  note: 'Machine state is authoritative. Prose is generated FROM this and cannot promote a NO_GO / NOT_YET. A green area roll-up is NOT release promotion — see verdicts.RELEASE_PROMOTION_VERDICT. Production deploy + old-credential revocation are OWNER actions.',
  runtimeMs: Date.now() - t0,
}
writeFileSync(resolve('docs/eval/QA_MONSTER_REPORT.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`\n=== areas ${report.counts.pass}/${report.counts.areas} · PRODUCT=${PRODUCT_CANDIDATE_VERDICT} · QA_SYSTEM=${QA_SYSTEM_VERDICT} · RELEASE=${RELEASE_PROMOTION_VERDICT} · ${Math.round(report.runtimeMs / 1000)}s ===`)
console.log(`identity: runtime=${RUNTIME_SOURCE_SHA} harness=${HARNESS_SHA?.slice(0, 8)} build=${DEPLOYED_BUILD_ID} · worktree runtime-clean=${WORKTREE_RUNTIME_CLEAN}`)
console.log(`exit: code=${decision.code} state=${decision.state} · ${decision.reason}`)
console.log('wrote docs/eval/QA_MONSTER_REPORT.json')

// ── §12 · seal a content-addressed Certification Capsule from the evidence just written ───────────
// Only for rc/production (feature has no deployed evidence to seal). Additive: capsule failure is
// surfaced but does not alter the proven release exit code — verify-capsule is the release-time gate.
if (mode === 'rc' || mode === 'production') {
  try {
    const out = execSync('node scripts/certification-capsule.mjs', { encoding: 'utf8' })
    console.log(out.trim().split('\n').filter((l) => /CAPSULE_ID|self-verify|provenance/.test(l)).join('\n'))
  } catch (e) { console.log('capsule generation FAILED: ' + ((e.stdout ?? '') + (e.stderr ?? e.message))) }
}
// Fail-closed, mode-aware exit. NEVER `pass ? 0 : 1` — success derives from the release state machine,
// and a missing/malformed/incomplete report yields INTEGRITY_FAIL (exit 4), never a default success.
process.exit(decision.code)
