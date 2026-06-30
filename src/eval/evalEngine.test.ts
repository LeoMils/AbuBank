/**
 * AbuAI Evaluation Engine — runner.
 * Runs the real-pipeline eval, writes the 4 reports to docs/eval/, stores a
 * baseline, detects regressions, and enforces a NORTH_STAR floor.
 *   npx vitest run src/eval/evalEngine.test.ts
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { runEval, detectRegressions, CAPABILITIES, DIMENSIONS, type EvalResult } from './evalEngine'

const FIXED = new Date('2026-06-24T20:00:00')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED) })
afterAll(() => { vi.useRealTimers() })
beforeEach(() => {
  const s: Record<string, string> = {}
  vi.stubGlobal('localStorage', { getItem: (k: string) => s[k] ?? null, setItem: (k: string, v: string) => { s[k] = v }, removeItem: () => {} })
  vi.stubGlobal('navigator', { onLine: true })
})

const OUT = path.resolve(__dirname, '../../docs/eval')
const BASELINE = path.join(OUT, 'baseline.json')
const FLOOR = 100 // % of deterministic dimensions that must pass

function bar(p: number, f: number, u: number): string {
  const t = p + f + u || 1
  return `${p}/${t} pass${f ? ` · ${f} FAIL` : ''}${u ? ` · ${u} uncertain` : ''}`
}

function writeReports(curr: EvalResult, prev: EvalResult | null, regressions: string[]): void {
  fs.mkdirSync(OUT, { recursive: true })

  const capLines = CAPABILITIES.map(c => { const v = curr.byCapability[c] ?? { pass: 0, fail: 0, uncertain: 0 }; return `| ${c} | ${bar(v.pass, v.fail, v.uncertain)} |` }).join('\n')
  const dimLines = DIMENSIONS.map(d => { const v = curr.byDimension[d] ?? { pass: 0, fail: 0, uncertain: 0 }; return `| ${d} | ${bar(v.pass, v.fail, v.uncertain)} |` }).join('\n')

  fs.writeFileSync(path.join(OUT, 'EVAL_REPORT.md'), `# AbuAI EVAL_REPORT

Cases: **${curr.total}** · scored dimensions: ${curr.passed + curr.failed} · uncertain (judge-required): ${curr.uncertain} · avg latency: ${curr.avgLatencyMs} ms

**NORTH_STAR_SCORE = ${curr.northStar}%** (deterministic dimensions passing). Uncertain
(LLM-prose) dimensions are scored separately by the offline judge — see judgePrompt.md.

## By capability
| Capability | Result |
|---|---|
${capLines}

## By dimension
| Dimension | Result |
|---|---|
${dimLines}

## Honesty
Deterministic dimensions (calendar/routing/language/safety/actionability/memory) are
asserted against the REAL pipeline — HIGH evidence. emotional-depth & naturalness of
LLM-generated prose are marked \`uncertain\` (not passed) and need the separate judge.
`)

  fs.writeFileSync(path.join(OUT, 'NORTH_STAR_SCORE.md'), `# NORTH_STAR_SCORE\n\n**${curr.northStar}%** — ${curr.passed}/${curr.passed + curr.failed} deterministic dimensions pass across ${curr.total} cases.\nUncertain (judge-required): ${curr.uncertain}. Avg latency: ${curr.avgLatencyMs} ms.\n${prev ? `\nPrevious: ${prev.northStar}% → Δ ${(curr.northStar - prev.northStar).toFixed(1)}%` : ''}\n`)

  fs.writeFileSync(path.join(OUT, 'REGRESSIONS.md'), `# REGRESSIONS\n\n${regressions.length ? regressions.map(r => `- ❌ ${r}`).join('\n') : '✅ none vs the stored baseline.'}\n\n## Hard failures this run\n${curr.failures.length ? curr.failures.slice(0, 40).map(f => `- ${f.capability}/${f.id}: ${Object.entries(f.verdicts).filter(([, v]) => v === 'fail').map(([d]) => d).join(',') || f.errors.join(';')}`).join('\n') : 'none'}\n`)

  // TOP_FIXES_BY_ROI: rank failing (capability,dimension) pairs by failure count.
  const pairs: Record<string, number> = {}
  for (const f of curr.failures) for (const [d, v] of Object.entries(f.verdicts)) if (v === 'fail') pairs[`${f.capability} · ${d}`] = (pairs[`${f.capability} · ${d}`] ?? 0) + 1
  const ranked = Object.entries(pairs).sort((a, b) => b[1] - a[1])
  fs.writeFileSync(path.join(OUT, 'TOP_FIXES_BY_ROI.md'), `# TOP_FIXES_BY_ROI\n\nFailing (capability · dimension) pairs, by how many user-moments they break.\nFix the top ONE, rerun the eval, measure the delta, repeat.\n\n${ranked.length ? ranked.map(([k, n], i) => `${i + 1}. **${k}** — ${n} broken moment(s)`).join('\n') : '✅ no deterministic failures. Next ROI: add NEW cases for an untested surface, or run the offline judge on the `uncertain` prose dimensions.'}\n`)
}

describe('AbuAI Evaluation Engine', () => {
  it('runs ≥500 cases against the real pipeline and writes the reports', () => {
    // SCALE: base generators yield ~210 cases; scale 3 → ≥500. Bump to 24 for ~5000.
    const curr = runEval(3)
    expect(curr.total).toBeGreaterThanOrEqual(500)

    const prev: EvalResult | null = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null
    const regressions = detectRegressions(prev, curr)
    writeReports(curr, prev, regressions)
    // store the new baseline (so the NEXT run compares against this one)
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(BASELINE, JSON.stringify({ northStar: curr.northStar, byCapability: curr.byCapability, byDimension: curr.byDimension, total: curr.total }, null, 0))

    // eslint-disable-next-line no-console
    console.log(`\n[NORTH_STAR_SCORE] ${curr.northStar}%  (${curr.passed}/${curr.passed + curr.failed} deterministic, ${curr.uncertain} uncertain, ${curr.total} cases)\n`)
    expect(regressions).toEqual([])
  })

  it(`NORTH_STAR is at or above the floor (${FLOOR}%)`, () => {
    const r = runEval(3)
    if (r.northStar < FLOOR) throw new Error(`NORTH_STAR ${r.northStar}% < floor ${FLOOR}%. Top broken: ${r.failures.slice(0, 10).map(f => f.id).join(', ')}`)
    expect(r.northStar).toBeGreaterThanOrEqual(FLOOR)
  })
})
