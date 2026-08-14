/*
 * scripts/eval/monitorAdversarialReport.ts — writes the per-detector interception report.
 * MODEL-FREE and NETWORK-FREE (pure): unlike monitorProbe (5 real turns), this runs the
 * deterministic detectors against a large GENERATED adversarial corpus and reports, per
 * detector, the interception (true-positive) rate, the false-positive rate, and the known
 * regex-uncatchable gaps. Answers "a detector that never fires is perfect or broken — prove which".
 *   npx vite-node scripts/eval/monitorAdversarialReport.ts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildAdversarialCorpus, measure } from '../../src/services/monitor/adversarialCorpus'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const corpus = buildAdversarialCorpus()
const reports = measure(corpus)
const pct = (n: number) => `${(n * 100).toFixed(1)}%`

const lines: string[] = []
lines.push('# M2 OUTPUT MONITOR — ADVERSARIAL INTERCEPTION REPORT')
lines.push('')
lines.push('Model-free, network-free. Each deterministic detector is run against a GENERATED')
lines.push('adversarial corpus (cases engineered to trigger it + clean/borderline cases engineered')
lines.push('to fool it). No value is taken verbatim from `outputMonitor.ts` (anti-circularity).')
lines.push('Interception = fraction of engineered violations caught. FP = fraction of clean caught.')
lines.push('')
lines.push(`Total corpus: ${corpus.length} cases.`)
lines.push('')
lines.push('| Detector | fire cases | intercepted | interception | clean cases | false positives | FP rate |')
lines.push('|---|---|---|---|---|---|---|')
for (const r of reports)
  lines.push(`| ${r.detector} | ${r.firePositives} | ${r.fired} | ${pct(r.interceptionRate)} | ${r.cleanNegatives} | ${r.falsePositives.length} | ${pct(r.falsePositiveRate)} |`)
lines.push('')
for (const r of reports) {
  lines.push(`### ${r.detector}`)
  lines.push(`- interception: ${r.fired}/${r.firePositives} (${pct(r.interceptionRate)}) · false positives: ${r.falsePositives.length}/${r.cleanNegatives} (${pct(r.falsePositiveRate)})`)
  if (r.missed.length) lines.push(`- MISSED (uncaught violations): ${r.missed.join(', ')}`)
  if (r.falsePositives.length) lines.push(`- FALSE POSITIVES (blocked good answers): ${r.falsePositives.join(', ')}`)
  if (r.gaps.length) lines.push(`- KNOWN GAPS (regex cannot catch — reported honestly): ${r.gaps.join(' · ')}`)
  lines.push('')
}
const out = lines.join('\n')
writeFileSync(join(ROOT, 'docs', 'eval', 'MONITOR_ADVERSARIAL_REPORT.md'), out + '\n')
console.log(out)
console.log('\nwritten: docs/eval/MONITOR_ADVERSARIAL_REPORT.md')
