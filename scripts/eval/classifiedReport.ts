/*
 * scripts/eval/classifiedReport.ts — M2 classified checks: FP + interception + detector latency.
 * Model-free. Writes docs/eval/MONITOR_CLASSIFIED_REPORT.md. The gate is the FALSE-POSITIVE
 * number — a classified check may gate output only once its FP rate on warm correct answers is
 * proven low. Detector latency (p50/p95) is measured here; the REPAIR round-trip latency and
 * warmth off-vs-on need the realtime instrument (API spend) and are reported as device-gated.
 *   npx vite-node scripts/eval/classifiedReport.ts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { buildClassifiedCorpus, measureClassified } from '../../src/services/monitor/classifiedCorpus'
import { classifyTurn } from '../../src/services/monitor/classifiedMonitor'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const corpus = buildClassifiedCorpus()
const reports = measureClassified(corpus)
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

// Detector latency over the whole corpus, many iterations (pure sync).
const samples: number[] = []
for (let iter = 0; iter < 200; iter++) for (const c of corpus) {
  const t0 = performance.now(); classifyTurn(c.spoken, c.ctx); samples.push(performance.now() - t0)
}
samples.sort((a, b) => a - b)
const p = (q: number) => samples[Math.min(samples.length - 1, Math.floor(q * samples.length))]!
const p50 = p(0.5), p95 = p(0.95)

const L: string[] = []
L.push('# M2 CLASSIFIED CHECKS — false-positive + interception report')
L.push('')
L.push('Model-free. The three classified checks judge INTENT, not surface form, so they carry')
L.push('real false-positive risk. The gate is the FP number: a check may gate output only once its')
L.push('false-positive rate on warm correct answers is proven low. Flag OFF by default until then.')
L.push(`Total corpus: ${corpus.length} cases.`)
L.push('')
L.push('| Check | fire | intercepted | interception | clean | false positives | FP rate |')
L.push('|---|---|---|---|---|---|---|')
for (const r of reports)
  L.push(`| ${r.detector} | ${r.firePositives} | ${r.fired} | ${pct(r.interceptionRate)} | ${r.cleanNegatives} | ${r.falsePositives.length} | ${pct(r.falsePositiveRate)} |`)
L.push('')
L.push('## Detector latency (pure sync, added per turn — repair round-trip is separate)')
L.push(`- p50: ${p50.toFixed(4)} ms · p95: ${p95.toFixed(4)} ms (${samples.length} samples)`)
L.push('- The classified detectors add sub-millisecond CPU per turn — negligible.')
L.push('- NOT measured here (needs the realtime instrument + API spend): the one-attempt REPAIR')
L.push('  round-trip latency and warmth/naturalness off-vs-on. Those are device-gated, like the')
L.push('  deterministic repair (LIVE_OUTPUT_MONITOR_REPAIR) — the flag stays OFF until measured.')
L.push('')
for (const r of reports) {
  L.push(`### ${r.detector}`)
  L.push(`- interception ${r.fired}/${r.firePositives} (${pct(r.interceptionRate)}) · FP ${r.falsePositives.length}/${r.cleanNegatives} (${pct(r.falsePositiveRate)})`)
  if (r.missed.length) L.push(`- MISSED: ${r.missed.join(', ')}`)
  if (r.falsePositives.length) L.push(`- FALSE POSITIVES (blocked good answers): ${r.falsePositives.join(', ')}`)
  L.push('')
}
const out = L.join('\n') + '\n'
writeFileSync(join(ROOT, 'docs', 'eval', 'MONITOR_CLASSIFIED_REPORT.md'), out)
console.log(out)
console.log('written: docs/eval/MONITOR_CLASSIFIED_REPORT.md')
