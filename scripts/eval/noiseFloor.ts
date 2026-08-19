/*
 * scripts/eval/noiseFloor.ts — PRIORITY 1, step 1: the measurement noise floor.
 * ════════════════════════════════════════════════════════════════════════════
 * Runs a FIXED subset (6 cases, 1 per category) through the scored instrument N times
 * (default 3) with NO code change between runs, then reports the per-criterion PASS-RATE
 * mean and POPULATION STANDARD DEVIATION across the runs. That stddev is the run-to-run
 * noise from model sampling — the bar a real before/after delta must clear. The
 * convergence rule: a regression beyond 2× this stddev is real; anything inside it is
 * noise (revert only the specific removal that caused a real regression).
 *
 * INSTRUMENT: REALTIME (gpt-realtime) by default — the faithful behavioral instrument.
 * The throttle is a VOLUME problem, solved by pacing + backoff + connect-error EXCLUSION
 * (isTransportFailure) and a small subset, NOT by demoting to the chat harness (which hides
 * the preamble failure). Set EVAL_INSTRUMENT=chat only for provably model-independent numbers.
 *
 *   npx vite-node scripts/eval/noiseFloor.ts          # 3 iterations, realtime
 *   NOISE_ITERS=5 npx vite-node scripts/eval/noiseFloor.ts
 *
 * Also reports the family→people_lookup tool-call rate per iteration (the D signal
 * baseline) and the latency distribution. Writes docs/eval/NOISE_FLOOR.json.
 * NEVER faked — a missing key BLOCKS, a run/judge error scores false.
 */
import './nodeShim'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  loadEnv, loadCorpus, runScored, perCriterionFraction, toolCallRate,
  stddev, mean, latencyPercentiles, ROOT, type Instrument, type ScoredCase,
} from './scoredEval'
import { CRITERIA } from './judge'

/** The FIXED subset — deterministic, ONE per category (6 cases). Small on purpose: the
 *  realtime WS throttles under volume, so the floor is 3 runs of a 6-case subset with pacing
 *  (not 60 calls). Do NOT change it between noise-floor runs. */
const SUBSET = [
  'online-01', 'family-01', 'calendar-01', 'comm-01', 'chat-01', 'cannot-01',
]

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  if (!openaiKey) { console.error('BLOCKED: no OPENAI_API_KEY — the noise floor is never faked.'); process.exit(2) }
  const braveKey = env.BRAVE_API_KEY
  // Realtime is the DEFAULT behavioral instrument (the chat harness hides the preamble
  // failure and must only be used for provably model-independent numbers). Set EVAL_INSTRUMENT=chat
  // to override — such numbers must be labelled as NOT measuring Abu.
  const instrument: Instrument = (env.EVAL_INSTRUMENT === 'chat') ? 'chat' : 'realtime'
  const model = env.EVAL_MODEL || (instrument === 'realtime' ? (env.EVAL_REALTIME_MODEL || 'gpt-realtime') : 'gpt-4o')
  const judgeModel = env.EVAL_JUDGE_MODEL || 'gpt-4o-mini'
  const iters = Number(env.NOISE_ITERS || '3') || 3
  const concurrency = Number(env.EVAL_CONCURRENCY || '3') || 3

  const corpus = loadCorpus()
  const byId = new Map(corpus.map((c) => [c.id, c]))
  const cases = SUBSET.map((id) => byId.get(id)).filter((c): c is NonNullable<typeof c> => !!c)
  if (cases.length !== SUBSET.length) console.error(`WARN: only ${cases.length}/${SUBSET.length} subset cases found`)

  console.error(`[noise] instrument=${instrument} model=${model} judge=${judgeModel} brave=${braveKey ? 'live' : 'MISSING'} · ${cases.length} cases × ${iters} iters · conc=${concurrency}`)

  const iterFractions: Array<Record<string, number>> = []
  const iterFamilyRate: number[] = []
  const iterAllPass: number[] = []
  const allLatencies: number[] = []
  const perIterScored: ScoredCase[][] = []

  for (let it = 0; it < iters; it++) {
    console.error(`\n──────── iteration ${it + 1}/${iters} ────────`)
    const scored = await runScored(cases, { instrument, openaiKey, braveKey, model, judgeModel, concurrency, label: `i${it + 1} ` })
    perIterScored.push(scored)
    const frac = perCriterionFraction(scored)
    iterFractions.push(frac)
    iterFamilyRate.push(toolCallRate(scored, 'family', 'people_lookup').rate)
    iterAllPass.push(scored.filter((s) => CRITERIA.every((c) => s.scores[c])).length / (scored.length || 1))
    for (const s of scored) allLatencies.push(s.run.latencyMs)
    console.error(`  iter ${it + 1}: allPass=${(iterAllPass[it]! * 100).toFixed(1)}%  family→people_lookup=${(iterFamilyRate[it]! * 100).toFixed(0)}%`)
  }

  // ── Per-criterion mean + population stddev across iterations (in pass-% points) ──
  const perCriterion: Record<string, { meanPct: number; stddevPct: number; values: number[] }> = {}
  for (const c of CRITERIA) {
    const vals = iterFractions.map((f) => f[c]! * 100)
    perCriterion[c] = { meanPct: Math.round(mean(vals) * 10) / 10, stddevPct: Math.round(stddev(vals) * 100) / 100, values: vals.map((v) => Math.round(v * 10) / 10) }
  }
  const allPassMean = Math.round(mean(iterAllPass.map((v) => v * 100)) * 10) / 10
  const allPassStd = Math.round(stddev(iterAllPass.map((v) => v * 100)) * 100) / 100
  const familyMean = Math.round(mean(iterFamilyRate.map((v) => v * 100)) * 10) / 10
  const lat = latencyPercentiles(allLatencies)
  const maxCritStd = Math.max(...CRITERIA.map((c) => perCriterion[c]!.stddevPct))

  const L: string[] = []
  L.push('════════════════════════════════════════════════════════════════')
  L.push(`NOISE FLOOR — ${instrument}/${model} (text) · ${cases.length} cases × ${iters} iters · judge=${judgeModel}`)
  L.push('════════════════════════════════════════════════════════════════')
  L.push(`OVERALL all-6-pass: mean ${allPassMean}%  ·  stddev ${allPassStd} pts`)
  L.push('')
  L.push('PER-CRITERION pass-% (mean ± population stddev across iterations):')
  for (const c of CRITERIA) L.push(`  ${c.padEnd(14)} ${String(perCriterion[c]!.meanPct).padStart(5)}%  ± ${perCriterion[c]!.stddevPct}   [${perCriterion[c]!.values.join(', ')}]`)
  L.push('')
  L.push(`WORST-CRITERION stddev: ${maxCritStd} pts  →  REGRESSION THRESHOLD (2×) = ${Math.round(maxCritStd * 2 * 100) / 100} pts`)
  L.push(`family → people_lookup call rate: mean ${familyMean}%  [${iterFamilyRate.map((v) => Math.round(v * 100)).join(', ')}]  (D baseline; should be ~0 pre-G)`)
  L.push(`latency ms: p50 ${lat.p50} · p95 ${lat.p95} · max ${lat.max}`)
  L.push('════════════════════════════════════════════════════════════════')
  const out = L.join('\n')
  console.log('\n' + out)

  writeFileSync(join(ROOT, 'docs/eval/NOISE_FLOOR.json'), JSON.stringify({
    note: 'measurement noise floor; secrets never stored',
    instrument, model, judgeModel, iters, subset: SUBSET,
    allPass: { meanPct: allPassMean, stddevPct: allPassStd, values: iterAllPass.map((v) => Math.round(v * 1000) / 10) },
    perCriterion,
    worstCriterionStddevPts: maxCritStd,
    regressionThresholdPts: Math.round(maxCritStd * 2 * 100) / 100,
    familyPeopleLookupRate: { meanPct: familyMean, values: iterFamilyRate.map((v) => Math.round(v * 1000) / 10) },
    latencyMs: lat,
  }, null, 2))
  console.error('[noise] wrote docs/eval/NOISE_FLOOR.json')
}

main().catch((e) => { console.error('NOISE_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })
