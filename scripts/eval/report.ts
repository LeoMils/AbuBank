/*
 * scripts/eval/report.ts — run the behavioral eval and print the numbers.
 * ════════════════════════════════════════════════════════════════════════════
 * npm run eval:behavior
 *   • loads OPENAI_API_KEY (+ BRAVE_API_KEY) from .env
 *   • runs every corpus case through the REAL live pipeline in text mode (runner)
 *   • scores each with the LLM judge on six binary criteria
 *   • prints overall pass %, per-criterion %, per-category %, and the 10 worst
 *     failures verbatim; writes docs/eval/BEHAVIOR_EVAL_BASELINE.json
 * EVIDENCE CLASS: this measures MODEL BEHAVIOR (does it obey the instructions),
 * not string presence — the gap the 12k unit tests cannot cover. It is a text-mode
 * Chat-Completions proxy for the realtime model (closest faithful text reproduction).
 */
import './nodeShim' // MUST be first — installs the localStorage shim before src/ imports
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { runCase, type EvalCase, type CaseRun } from './runner'
import { judgeCase, CRITERIA, type Scores } from './judge'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2]!
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[m[1]!] = v
    }
  } catch { /* no .env */ }
  return { ...env, ...process.env as Record<string, string> }
}

function loadCorpus(): EvalCase[] {
  const raw = readFileSync(join(HERE, 'corpus.jsonl'), 'utf8')
  return raw.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as EvalCase)
}

/** Bounded-concurrency map (keeps the OpenAI/Brave call rate sane). */
async function pool<T, R>(items: T[], size: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i]!, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

function pct(n: number, d: number): number { return d === 0 ? 0 : Math.round((n / d) * 1000) / 10 }

async function main() {
  const env = loadEnv()
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
  if (!openaiKey) {
    console.error('BLOCKED: OPENAI_API_KEY is not set — cannot run the behavioral eval (never faked).')
    process.exit(2)
  }
  const braveKey = env.BRAVE_API_KEY
  const pipelineModel = env.EVAL_PIPELINE_MODEL || 'gpt-4o'
  const judgeModel = env.EVAL_JUDGE_MODEL || 'gpt-4o-mini'
  const corpus = loadCorpus()
  const concurrency = Number(env.EVAL_CONCURRENCY || '2') || 2

  console.error(`[eval] ${corpus.length} cases · pipeline=${pipelineModel} · judge=${judgeModel} · brave=${braveKey ? 'live' : 'MISSING'} · concurrency=${concurrency}`)

  const runs: CaseRun[] = await pool(corpus, concurrency, async (tc, i) => {
    const r = await runCase(tc, { openaiKey, braveKey, model: pipelineModel })
    console.error(`[run ${i + 1}/${corpus.length}] ${tc.id} · tools=[${r.toolCalls.map((t) => t.name).join(',')}] · preTool=${r.emittedTextBeforeToolResult} · ${r.latencyMs}ms${r.error ? ' · ERR:' + r.error.slice(0, 60) : ''}`)
    return r
  })

  const scored: Array<{ run: CaseRun; scores: Scores }> = await pool(runs, concurrency, async (run, i) => {
    const scores = await judgeCase(run, { openaiKey, model: judgeModel })
    console.error(`[judge ${i + 1}/${runs.length}] ${run.id} · ${CRITERIA.map((c) => `${c[0]}${scores[c] ? '1' : '0'}`).join(' ')}`)
    return { run, scores }
  })

  // ── Aggregate ──
  const total = scored.length
  const allPass = scored.filter((s) => CRITERIA.every((c) => s.scores[c])).length
  const perCriterion: Record<string, number> = {}
  for (const c of CRITERIA) perCriterion[c] = pct(scored.filter((s) => s.scores[c]).length, total)

  const categories = [...new Set(corpus.map((c) => c.category))]
  const perCategory: Record<string, { passAll: number; n: number }> = {}
  for (const cat of categories) {
    const rows = scored.filter((s) => s.run.category === cat)
    perCategory[cat] = { passAll: pct(rows.filter((s) => CRITERIA.every((c) => s.scores[c])).length, rows.length), n: rows.length }
  }

  // Ground-truth mechanical signal (independent of the judge).
  const preToolTurns = scored.filter((s) => s.run.emittedTextBeforeToolResult).length
  const casesWithTools = scored.filter((s) => s.run.toolCalls.length > 0).length

  // 10 worst = most failed criteria (tie-break: preamble-before-tool first).
  const worst = [...scored]
    .map((s) => ({ ...s, fails: CRITERIA.filter((c) => !s.scores[c]) }))
    .filter((s) => s.fails.length > 0)
    .sort((a, b) => b.fails.length - a.fails.length || Number(b.run.emittedTextBeforeToolResult) - Number(a.run.emittedTextBeforeToolResult))
    .slice(0, 10)

  // ── Print ──
  const L: string[] = []
  L.push('════════════════════════════════════════════════════════════════')
  L.push('BEHAVIORAL EVAL — BASELINE (measures model behavior, not code)')
  L.push(`pipeline=${pipelineModel} (text-mode proxy for the realtime model) · judge=${judgeModel}`)
  L.push('════════════════════════════════════════════════════════════════')
  L.push(`OVERALL PASS (all 6 criteria): ${allPass}/${total} = ${pct(allPass, total)}%`)
  L.push('')
  L.push('PER CRITERION:')
  for (const c of CRITERIA) L.push(`  ${c.padEnd(14)} ${perCriterion[c]}%`)
  L.push('')
  L.push('PER CATEGORY (all-6 pass):')
  for (const cat of categories) L.push(`  ${cat.padEnd(10)} ${perCategory[cat]!.passAll}%  (n=${perCategory[cat]!.n})`)
  L.push('')
  L.push(`GROUND-TRUTH PREAMBLE SIGNAL: assistant text emitted BEFORE a tool result in ${preToolTurns}/${casesWithTools} tool-using cases = ${pct(preToolTurns, casesWithTools)}%`)
  L.push('  (this is the exact failure a string-grep test cannot see)')
  L.push('')
  L.push('10 WORST FAILURES (verbatim):')
  worst.forEach((w, i) => {
    L.push(`  ${i + 1}. [${w.run.id}] fails: ${w.fails.join(', ')}`)
    L.push(`     user:  ${w.run.user}`)
    if (w.run.preambleSegments.length) L.push(`     preamble-before-tool: ${JSON.stringify(w.run.preambleSegments.join(' | '))}`)
    L.push(`     said:  ${JSON.stringify(w.run.fullSpoken).slice(0, 300)}`)
    L.push(`     why:   ${w.scores.rationale}`)
  })
  L.push('════════════════════════════════════════════════════════════════')
  const out = L.join('\n')
  console.log(out)

  writeFileSync(join(ROOT, 'docs/eval/BEHAVIOR_EVAL_BASELINE.json'), JSON.stringify({
    generatedNote: 'behavioral eval baseline; secrets never stored',
    pipelineModel, judgeModel, total, overallPassPct: pct(allPass, total),
    perCriterion, perCategory, preToolPreamblePct: pct(preToolTurns, casesWithTools),
    cases: scored.map((s) => ({ id: s.run.id, category: s.run.category, user: s.run.user, scores: s.scores, emittedTextBeforeToolResult: s.run.emittedTextBeforeToolResult, tools: s.run.toolCalls.map((t) => t.name), preamble: s.run.preambleSegments, said: s.run.fullSpoken, latencyMs: s.run.latencyMs, error: s.run.error })),
  }, null, 2))
  console.error('[eval] wrote docs/eval/BEHAVIOR_EVAL_BASELINE.json')
}

main().catch((e) => { console.error('EVAL_ERROR', e?.stack || e?.message || String(e)); process.exit(1) })
