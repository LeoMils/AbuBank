/*
 * scripts/eval/scoredEval.ts — score corpus cases on either instrument, with the judge.
 * ════════════════════════════════════════════════════════════════════════════
 * TWO instruments, ONE judge (judge.ts), ONE bundle (buildSessionUpdate):
 *   • CHAT  (runner.ts, gpt-4o chat-completions) — the VOLUME workhorse. Standard chat
 *     rate limits sustain the noise floor (fixed subset ×5), the full baseline, and the
 *     convergence loop. It is the maintained scored pipeline report.ts already uses, and
 *     it reads the exact same instructions + tools the voice path sends.
 *   • REALTIME (realtimeRunner.ts, gpt-realtime WS) — the FAITHFUL instrument, but the GA
 *     WS THROTTLES under volume here (a ~60-call noise floor collapses into connect-error
 *     all-false scores — an infrastructure artifact, measured and reported, not faked). So
 *     realtime is used only for SMALL confirmation probes, sequential with retry.
 *
 * Both feed the same six-criterion judge. Nothing is ever fabricated — a run/judge error
 * scores every criterion false honestly.
 */
import './nodeShim'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runCase, type EvalCase, type CaseRun } from './runner'
import { runConversationRealtime, type TurnRecord } from './realtimeRunner'
import { judgeCase, CRITERIA, type Criterion, type Scores } from './judge'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(HERE, '..', '..')

export function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
      let v = m[2]!; if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[m[1]!] = v
    }
  } catch { /* no .env */ }
  return { ...env, ...process.env as Record<string, string> }
}

export function loadCorpus(): EvalCase[] {
  const raw = readFileSync(join(HERE, 'corpus.jsonl'), 'utf8')
  return raw.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as EvalCase)
}

/** Adapt one realtime TurnRecord to the judge's CaseRun shape. */
export function adaptTurnToCaseRun(tc: EvalCase, rec: TurnRecord): CaseRun {
  const text = (rec.text ?? '').trim()
  return {
    id: tc.id, category: tc.category, user: tc.user, expected: tc.expect,
    spokenSegments: text ? [text] : [],
    preambleSegments: rec.preambleText ? [rec.preambleText.trim()] : [],
    finalText: text, fullSpoken: text,
    toolCalls: rec.toolCalls,
    emittedTextBeforeToolResult: rec.emittedTextBeforeToolResult,
    latencyMs: rec.totalMs,
    ...(rec.error ? { error: rec.error } : {}),
  }
}

/** Bounded-concurrency map. */
export async function pool<T, R>(items: T[], size: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() { for (;;) { const i = next++; if (i >= items.length) return; out[i] = await fn(items[i]!, i) } }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker))
  return out
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A realtime run is a TRANSPORT failure (a connect/session drop, throttle) — NOT a real
 *  "no tool call" or a zero score — when it errored or came back empty in under 500ms. Per
 *  the throttle finding: a connect error must NEVER enter a score. These are retried, and if
 *  they persist, EXCLUDED from the scored set (reported separately), never counted as 0. */
export function isTransportFailure(run: CaseRun): boolean {
  return !!run.error || (run.latencyMs < 500 && !run.fullSpoken.trim() && run.toolCalls.length === 0)
}

export type Instrument = 'chat' | 'realtime'
export interface ScoredCase { run: CaseRun; scores: Scores }
export interface RunScoredOpts {
  instrument?: Instrument
  openaiKey: string; braveKey?: string; model?: string; judgeModel?: string
  concurrency?: number          // judge (+ chat pipeline) concurrency
  realtimeConcurrency?: number  // realtime WS concurrency (keep 1)
  label?: string
}

async function realtimeTurnWithRetry(tc: EvalCase, opts: RunScoredOpts): Promise<CaseRun> {
  let run: CaseRun | null = null
  for (let attempt = 0; attempt < 4; attempt++) {
    const recs = await runConversationRealtime([tc.user], { openaiKey: opts.openaiKey, braveKey: opts.braveKey, model: opts.model })
    run = adaptTurnToCaseRun(tc, recs[0]!)
    if (!isTransportFailure(run)) return run
    await sleep(2000 * 2 ** attempt) // exponential backoff on connect/throttle: 2s,4s,8s,16s
  }
  return run! // still a transport failure → caller EXCLUDES it (never scores it 0)
}

/** Run each case through the chosen instrument, then judge it. Realtime is the DEFAULT
 *  behavioral instrument (the chat harness hides the preamble failure and must only be used
 *  for provably model-independent numbers). Transport failures are excluded, never scored. */
export async function runScored(cases: EvalCase[], opts: RunScoredOpts): Promise<ScoredCase[]> {
  const instrument = opts.instrument ?? 'realtime'
  const judgeConc = opts.concurrency ?? 3
  const tag = opts.label ? `${opts.label}` : ''
  let runs: CaseRun[]
  if (instrument === 'realtime') {
    const rtConc = opts.realtimeConcurrency ?? 1
    const all = await pool(cases, rtConc, async (tc, i) => {
      const run = await realtimeTurnWithRetry(tc, opts)
      const failed = isTransportFailure(run)
      console.error(`[${tag}rt ${i + 1}/${cases.length}] ${tc.id} tools=[${run.toolCalls.map((t) => t.name).join(',')}] ${run.latencyMs}ms${failed ? ' ⚠ TRANSPORT-FAIL (excluded)' : ''}`)
      if (rtConc === 1) await sleep(1500) // pace sequential sessions so we do not trip the throttle
      return run
    })
    const excluded = all.filter(isTransportFailure).length
    if (excluded > 0) console.error(`[${tag}rt] EXCLUDED ${excluded}/${cases.length} transport failures from scoring (never scored 0)`)
    runs = all.filter((r) => !isTransportFailure(r))
  } else {
    const model = opts.model ?? 'gpt-4o'
    runs = await pool(cases, judgeConc, async (tc, i) => {
      const run = await runCase(tc, { openaiKey: opts.openaiKey, braveKey: opts.braveKey, model })
      console.error(`[${tag}chat ${i + 1}/${cases.length}] ${tc.id} tools=[${run.toolCalls.map((t) => t.name).join(',')}] preTool=${run.emittedTextBeforeToolResult} ${run.latencyMs}ms${run.error ? ' ERR ' + run.error.slice(0, 50) : ''}`)
      return run
    })
  }
  return pool(runs, judgeConc, async (run, i) => {
    const scores = await judgeCase(run, { openaiKey: opts.openaiKey, model: opts.judgeModel ?? 'gpt-4o-mini' })
    console.error(`[${tag}judge ${i + 1}/${runs.length}] ${run.id} ${CRITERIA.map((c) => c[0] + (scores[c] ? '1' : '0')).join(' ')}`)
    return { run, scores }
  })
}

/** Per-criterion PASS FRACTION (0..1). */
export function perCriterionFraction(scored: ScoredCase[]): Record<Criterion, number> {
  const out = {} as Record<Criterion, number>
  const n = scored.length || 1
  for (const c of CRITERIA) out[c] = scored.filter((s) => s.scores[c]).length / n
  return out
}

/** Fraction of the given category's cases that made ≥1 call to a named tool. */
export function toolCallRate(scored: ScoredCase[], category: string, toolName: string): { rate: number; n: number } {
  const rows = scored.filter((s) => s.run.category === category)
  if (rows.length === 0) return { rate: 0, n: 0 }
  const hit = rows.filter((s) => s.run.toolCalls.some((t) => t.name === toolName)).length
  return { rate: hit / rows.length, n: rows.length }
}

export function stddev(xs: number[]): number {
  if (xs.length === 0) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
}
export function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }

export function latencyPercentiles(ms: number[]): { p50: number; p95: number; max: number } {
  if (ms.length === 0) return { p50: 0, p95: 0, max: 0 }
  const s = [...ms].sort((a, b) => a - b)
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]!
  return { p50: at(0.5), p95: at(0.95), max: s[s.length - 1]! }
}
