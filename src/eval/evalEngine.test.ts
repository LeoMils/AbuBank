/**
 * AbuAI Evaluation Engine — runner.
 * Runs the real-pipeline deterministic eval + a SEPARATE rule judge on the prose
 * dimensions, writes the reports + judge-results.json to docs/eval/, detects
 * regressions, and enforces a NORTH_STAR floor + a judged-score floor.
 *   npx vitest run src/eval/evalEngine.test.ts
 */
import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { runEval, judgeCandidates, detectRegressions, CAPABILITIES, DIMENSIONS, type EvalResult } from './evalEngine'
import { runJudge } from './judgeRunner'

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
const FLOOR = 100        // deterministic dimension pass-rate
const JUDGE_FLOOR = 95   // judged prose score
const SCALE = 3

function bar(p: number, f: number, u: number): string {
  const t = p + f + u || 1
  return `${p}/${t} pass${f ? ` · ${f} FAIL` : ''}${u ? ` · ${u} uncertain` : ''}`
}

describe('AbuAI Evaluation Engine', () => {
  it('runs ≥500 cases + judge pass, writes reports, no regression', () => {
    const curr = runEval(SCALE)
    const judge = runJudge(judgeCandidates(SCALE))
    expect(curr.total).toBeGreaterThanOrEqual(500)
    fs.mkdirSync(OUT, { recursive: true })

    const prev: EvalResult | null = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null
    const regressions = detectRegressions(prev, curr)

    // coverage counts per capability (deterministic cases)
    const cov: Record<string, number> = {}
    for (const cap of CAPABILITIES) { const v = curr.byCapability[cap]; cov[cap] = v ? v.pass + v.fail + v.uncertain : 0 }

    const capLines = CAPABILITIES.map(c => { const v = curr.byCapability[c] ?? { pass: 0, fail: 0, uncertain: 0 }; const j = judge.byCapability[c]; return `| ${c} | ${bar(v.pass, v.fail, v.uncertain)} | ${j ? `${j.avg} (${j.pass}/${j.n})` : '—'} |` }).join('\n')
    const dimLines = DIMENSIONS.map(d => { const v = curr.byDimension[d] ?? { pass: 0, fail: 0, uncertain: 0 }; return `| ${d} | ${bar(v.pass, v.fail, v.uncertain)} |` }).join('\n')

    fs.writeFileSync(path.join(OUT, 'EVAL_REPORT.md'), `# AbuAI EVAL_REPORT

Deterministic cases: **${curr.total}** · scored dims: ${curr.passed + curr.failed} · uncertain: ${curr.uncertain} · avg latency: ${curr.avgLatencyMs} ms
Judge candidates (separate rule judge, NOT AbuAI): **${judge.count}** · avg score: **${judge.avgScore}** · pass(≥${JUDGE_FLOOR}): ${judge.passed} · fail: ${judge.failed} · uncertain: ${judge.uncertain}

**NORTH_STAR (deterministic) = ${curr.northStar}%** · **JUDGE = ${judge.avgScore}/100**

## By capability
| Capability | Deterministic | Judged prose (avg, pass/n) |
|---|---|---|
${capLines}

## By dimension (deterministic)
| Dimension | Result |
|---|---|
${dimLines}

## Coverage (deterministic cases per capability)
${CAPABILITIES.map(c => `- ${c}: ${cov[c]}`).join('\n')}

## Honesty
Deterministic dims are asserted against the REAL pipeline (HIGH evidence). Prose
dims are scored by a SEPARATE rule judge (judgeRunner.ts, NOT AbuAI) on the
DETERMINISTIC responses the pipeline produces (companion fallback / continuation /
repair / voice-shaped / failure copy). **LLM-generated answer prose (the natural
family/emotional answer) has no in-code candidate and is reported NON-CODE — it
needs a live model + the offline judge in judgePrompt.md.**
`)

    fs.writeFileSync(path.join(OUT, 'NORTH_STAR_SCORE.md'), `# NORTH_STAR_SCORE\n\n- Deterministic: **${curr.northStar}%** (${curr.passed}/${curr.passed + curr.failed}) across ${curr.total} cases.\n- Judged prose: **${judge.avgScore}/100** (${judge.passed}/${judge.count} ≥ ${JUDGE_FLOOR}).\n${prev ? `- Previous deterministic: ${prev.northStar}% → Δ ${(curr.northStar - prev.northStar).toFixed(1)}%` : ''}\n`)

    fs.writeFileSync(path.join(OUT, 'REGRESSIONS.md'), `# REGRESSIONS\n\n${regressions.length ? regressions.map(r => `- ❌ ${r}`).join('\n') : '✅ none vs the stored baseline.'}\n\n## Hard deterministic failures\n${curr.failures.length ? curr.failures.slice(0, 40).map(f => `- ${f.capability}/${f.id}: ${Object.entries(f.verdicts).filter(([, v]) => v === 'fail').map(([d]) => d).join(',') || f.errors.join(';')}`).join('\n') : 'none'}\n\n## Judge failures (<${JUDGE_FLOOR})\n${judge.scores.filter(s => s.score < JUDGE_FLOOR && !s.uncertain).map(s => `- ${s.capability}/${s.id}: ${s.score} — ${s.reason}`).join('\n') || 'none'}\n`)

    const pairs: Record<string, number> = {}
    for (const f of curr.failures) for (const [d, v] of Object.entries(f.verdicts)) if (v === 'fail') pairs[`${f.capability} · ${d}`] = (pairs[`${f.capability} · ${d}`] ?? 0) + 1
    for (const s of judge.scores) if (s.score < JUDGE_FLOOR && !s.uncertain) pairs[`${s.capability} · ${s.dimension} (judge)`] = (pairs[`${s.capability} · ${s.dimension} (judge)`] ?? 0) + 1
    const ranked = Object.entries(pairs).sort((a, b) => b[1] - a[1])
    fs.writeFileSync(path.join(OUT, 'TOP_FIXES_BY_ROI.md'), `# TOP_FIXES_BY_ROI\n\nFailing (capability · dimension) by broken moments. Fix the top ONE, rerun, repeat.\n\n${ranked.length ? ranked.map(([k, n], i) => `${i + 1}. **${k}** — ${n} broken moment(s)`).join('\n') : '✅ no deterministic or judge failures. Next ROI: expand a thin surface, or run the offline LLM judge (judgePrompt.md) on the NON-CODE family/emotional answer prose.'}\n`)

    fs.writeFileSync(path.join(OUT, 'judge-results.json'), JSON.stringify({ avgScore: judge.avgScore, passed: judge.passed, failed: judge.failed, uncertain: judge.uncertain, byCapability: judge.byCapability, scores: judge.scores }, null, 0))
    fs.writeFileSync(BASELINE, JSON.stringify({ northStar: curr.northStar, byCapability: curr.byCapability, byDimension: curr.byDimension, total: curr.total }, null, 0))

    // eslint-disable-next-line no-console
    console.log(`\n[NORTH_STAR] ${curr.northStar}% deterministic (${curr.total} cases) · JUDGE ${judge.avgScore}/100 (${judge.passed}/${judge.count})\n[COVERAGE] ${CAPABILITIES.map(c => `${c}:${cov[c]}`).join(' ')}\n`)
    expect(regressions).toEqual([])
  })

  it(`deterministic NORTH_STAR ≥ ${FLOOR}% and judged prose ≥ ${JUDGE_FLOOR}`, () => {
    const r = runEval(SCALE)
    const j = runJudge(judgeCandidates(SCALE))
    if (r.northStar < FLOOR) throw new Error(`NORTH_STAR ${r.northStar}% < ${FLOOR}%. Broken: ${r.failures.slice(0, 8).map(f => f.id).join(', ')}`)
    const judgeFails = j.scores.filter(s => s.score < JUDGE_FLOOR && !s.uncertain)
    if (judgeFails.length) throw new Error(`Judge below ${JUDGE_FLOOR}: ${judgeFails.slice(0, 8).map(s => `${s.id}=${s.score}`).join(', ')}`)
    expect(r.northStar).toBeGreaterThanOrEqual(FLOOR)
    expect(j.avgScore).toBeGreaterThanOrEqual(JUDGE_FLOOR)
  })
})
