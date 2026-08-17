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
const pass = areas.every((a) => a.pass)
const report = {
  $schema: 'internal://abu/qa-monster', mode, target: url ?? null, when: new Date().toISOString(),
  gitHead: (() => { try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() } catch { return null } })(),
  verdict: pass ? 'GO' : 'NO_GO',
  counts: {
    areas: areas.length, pass: areas.filter((a) => a.pass).length, fail: areas.filter((a) => !a.pass).length,
    AUTOMATABLE_DEFECT_ESCAPES_DISCOVERED_BY_LEO: corpus?.score?.STILL_OPEN ?? null,
  },
  areas,
  note: 'Machine state is authoritative. Prose is generated FROM this. Prose cannot promote a NO_GO. Production deploy requires explicit owner authorization; old-credential revocation is OWNER_ACTION_OPEN until confirmed.',
  runtimeMs: Date.now() - t0,
}
writeFileSync(resolve('docs/eval/QA_MONSTER_REPORT.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`\n=== ${report.verdict} · ${report.counts.pass}/${report.counts.areas} areas · ${Math.round(report.runtimeMs / 1000)}s ===`)
console.log('wrote docs/eval/QA_MONSTER_REPORT.json')
process.exit(pass ? 0 : 1)
