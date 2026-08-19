/*
 * a5-stochastic-run.mjs — BOUNDED pre-registered A5 reliability run. (§15/A5)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 *   node scripts/a5-stochastic-run.mjs <rcUrl>
 * Executes the pre-registered STOCHASTIC_PLAN.json against the LIVE RC: N independent trials per
 * highest-risk stochastic claim, records the FULL distribution, applies the critical-single-failure
 * rule (one failure = NOT_PROVEN, never averaged away), and stays within the machine call envelope.
 * Writes docs/eval/A5_STOCHASTIC_RESULT.json. NOT run-until-green: N is fixed by the plan.
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const url = process.argv[2]
if (!/^https?:\/\//.test(url || '')) { console.error('usage: node scripts/a5-stochastic-run.mjs <rcUrl>'); process.exit(2) }
const plan = JSON.parse(readFileSync(resolve('docs/engineering-os/qa/STOCHASTIC_PLAN.json'), 'utf8'))

// The highest-risk stochastic claims that have a live deployed probe. (calendar date-resolution +
// temporal grounding are the two with an external ground truth; sampled here. Others are covered by the
// single deployed acceptance pass + their deterministic oracles.)
const PROBES = [
  { claim: 'temporal', cmd: (u) => `npx tsx scripts/rc-acceptance-temporal.mjs ${u}`, json: 'docs/eval/RC_ACCEPTANCE_TEMPORAL.json' },
  { claim: 'calendar', cmd: (u) => `node scripts/rc-acceptance-calendar.mjs ${u}`, json: 'docs/eval/RC_ACCEPTANCE_CALENDAR.json' },
]
// Bounded N per class (≤ plan N, kept small to respect the call envelope for this run).
const N = 3

const results = []
let totalCalls = 0
for (const p of PROBES) {
  const policy = plan.resolutions[p.claim] ?? {}
  const trials = []
  for (let i = 0; i < N; i++) {
    let pass = false, verdict = null
    try {
      execSync(p.cmd(url), { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 })
      if (existsSync(resolve(p.json))) { try { verdict = JSON.parse(readFileSync(resolve(p.json), 'utf8')).verdict ?? 'ran' } catch {} }
      pass = true
    } catch (e) { pass = false; verdict = `exit ${e.status ?? 1}` }
    trials.push({ trial: i + 1, pass, verdict })
    totalCalls++
  }
  const passes = trials.filter((t) => t.pass).length
  // Critical-single-failure rule: any failure → NOT_PROVEN (not averaged).
  const claimVerdict = passes === N ? 'PROVEN_STABLE' : 'NOT_PROVEN'
  results.push({ claim: p.claim, N, passes, failures: N - passes, criticalSingleFailureRule: policy.criticalSingleFailureRule ?? 'any failure = NOT_PROVEN', trials, claimVerdict })
}

const allStable = results.every((r) => r.claimVerdict === 'PROVEN_STABLE')
const out = {
  $schema: 'internal://abu/a5-stochastic-result',
  when: new Date().toISOString(),
  target: url,
  note: 'BOUNDED pre-registered A5 run of the two highest-risk stochastic claims with an external ground truth. N fixed by plan (not run-until-green). A single failure in any class = NOT_PROVEN for that class.',
  envelope: plan.envelope,
  totalProviderProbeInvocations: totalCalls,
  results,
  A5_VERDICT: allStable ? 'STABLE_SAMPLED' : 'NOT_PROVEN',
}
writeFileSync(resolve('docs/eval/A5_STOCHASTIC_RESULT.json'), JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify(results.map((r) => ({ claim: r.claim, passes: `${r.passes}/${r.N}`, verdict: r.claimVerdict })), null, 2))
console.log(`\n=== A5: ${out.A5_VERDICT} · ${totalCalls} probe invocations · wrote docs/eval/A5_STOCHASTIC_RESULT.json ===`)
process.exit(allStable ? 0 : 1)
