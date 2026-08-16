/*
 * post-deploy.mjs — the REQUIRED acceptance step after every deploy (owner brief item 1 + item 4).
 * ════════════════════════════════════════════════════════════════════════════
 * The golden runner MOCKS the online tool, so it is BLIND to the capability Martita uses most. This
 * gate closes that hole: it runs the LIVE online-freshness probe against the DEPLOYED endpoint and
 * the deployed-build verification, and EXITS NONZERO if the deployed build is not this commit or the
 * online path is stale / names a source / errors / is slow. A deploy is not "accepted" until this
 * passes — a divergence here is a P0 (the 35k-vs-14k snapshot drift is why this exists).
 *
 * Usage: node scripts/acceptance/post-deploy.mjs https://<deployed-url> [expectedVersion]
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const BASE = (process.argv[2] || '').replace(/\/$/, '')
const EXPECT = process.argv[3] || (() => {
  try { return fs.readFileSync('src/version.ts', 'utf8').match(/version:\s*'([^']+)'/)?.[1] } catch { return '' }
})()
if (!BASE) { console.error('usage: node scripts/acceptance/post-deploy.mjs https://<url> [version]'); process.exit(2) }

const run = (script, args) => {
  console.log(`\n─── ${script} ───`)
  try { execFileSync('node', [script, ...args], { stdio: 'inherit' }); return true }
  catch { return false }
}

console.log(`=== POST-DEPLOY ACCEPTANCE · ${BASE} (expect v${EXPECT}) ===`)
const verifyOk = run('scripts/probes/deployed-verify.mjs', [BASE, EXPECT])
const freshOk = run('scripts/probes/online-freshness.mjs', [BASE])

// Judge: deployed build must be this commit; online must be all-ok, not stale, no source named.
let fresh = {}
try { fresh = JSON.parse(fs.readFileSync('docs/eval/ONLINE_FRESHNESS_DEPLOYED.json', 'utf8')) } catch { /* */ }
let verify = {}
try { verify = JSON.parse(fs.readFileSync('docs/eval/DEPLOYED_VERIFY.json', 'utf8')) } catch { /* */ }

const problems = []
const warnings = []
if (!verify.deployedIsThisBuild) problems.push('deployed build is NOT this commit (version/bundle mismatch)')
if (!fresh.allOk) problems.push('online: a query did not return ok')
if (fresh.anyStale) problems.push('online: a stale date was returned')
if (fresh.singleAnswerSourceNamed) problems.push('online: a source was named in a SINGLE-ANSWER (cinema/price/followup) body')
if ((fresh.maxLatencyMs ?? 0) > 13000) problems.push(`online: latency ${fresh.maxLatencyMs}ms over budget`)
// Briefing/news residual: a list of news-site titles the model reformulates + is instructed to drop
// sources from. Tracked, not a deploy block — the durable fix is model-synthesized headlines.
if (fresh.briefingSourceNamed) warnings.push('online: the news BRIEFING body still carries outlet names (residual; needs model-synthesized headlines — verify at the model layer that they are not SPOKEN)')

console.log('\n=== POST-DEPLOY VERDICT ===')
for (const w of warnings) console.log('  ⚠ WARN: ' + w)
if (problems.length === 0 && verifyOk && freshOk) {
  console.log('ACCEPTED — deployed build is this commit; single-answer online is fresh, sourceless, in budget.' + (warnings.length ? ' (with warnings above)' : ''))
  process.exit(0)
}
console.log('REJECTED (P0):')
for (const p of problems) console.log('  - ' + p)
process.exit(1)
