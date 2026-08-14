/*
 * generalSearch.ts — ONE general agentic search loop for EVERY question. No per-topic gates.
 * ════════════════════════════════════════════════════════════════════════════
 * The old design had a relevance gate for prices, and the plan was to add one for news, one for
 * weather, one for film. An 81-year-old asks ANYTHING, so that patchwork never covers her. This
 * is the general mechanism a voice assistant with web access uses:
 *
 *   1. SEARCH     — a query derived from what she asked.
 *   2. FETCH      — top result pages in parallel, first-wins on substantial content, abort the rest.
 *   3. JUDGE+SYNTH — a CHEAP MODEL answers ONE general question: does this text actually answer
 *                    what was asked? If yes, it returns ONE clean answer; if no, no_answer. There is
 *                    NO type-specific heuristic ("has a currency symbol") anywhere in this path.
 *   4. REFINE     — on no_answer, reformulate the query (up to twice) and repeat — a bad first search
 *                    self-corrects instead of returning a page description. Only if budget remains.
 *   5. HONEST MISS — attempts exhausted → no_answer; the caller says one short sentence, never a dump.
 *
 * Budgets are respected: a refine starts only if enough of the hard ceiling remains. Pure over
 * injected seams (search / fetchPage / synthesize), so it is unit-tested with fakes — no network,
 * no model. The SAME loop serves the live tool (firstWinsFetch) and the endpoint (abuai-online).
 *
 * THE ORACLE LIMIT (stated, not implied away): there is no independent oracle for the web. This
 * loop cannot assert the correct price/headline. It asserts only what is checkable — a real answer
 * of the requested KIND, no source named, within budget — and an honest no_answer instead of a dump.
 */
import { firstWins, contentWords, type FwSource } from './firstWins'
import type { Synthesis } from './synthesize'

export interface GeneralSearchOpts {
  /** Real search seam → ranked result URLs for a (possibly reformulated) query. */
  search: (query: string) => Promise<FwSource[]>
  /** Real page fetch → raw HTML/text; MUST honour the AbortSignal. */
  fetchPage: (url: string, signal: AbortSignal) => Promise<string>
  /** The cheap-model JUDGE + SYNTHESIZER: answer or honest no_answer for the ORIGINAL question. */
  synthesize: (originalQuery: string, pageText: string) => Promise<Synthesis>
  now?: () => number
  topN?: number             // pages per attempt (default 4)
  maxAttempts?: number      // total attempts incl the first — default 2 (→ 1 refine), max 3
  softBudgetMs?: number     // first-token target (default 4000)
  hardCeilingMs?: number    // hard ceiling (default 6000)
  /** Do not START another attempt unless at least this much of the ceiling remains. */
  minAttemptSliceMs?: number // default 1800
  /** Time RESERVED for the synthesize (judge) call, subtracted from the fetch budget so the
   *  TOTAL (fetch + judge) stays within the ceiling — otherwise the judge overruns it. */
  synthReserveMs?: number    // default 1800
}

export interface GeneralSearchResult {
  status: 'answer' | 'no_answer'
  answer: string
  attempts: number
  queriesTried: string[]
  ms: number
  timedOut: boolean
}

/**
 * Reformulate a query for a refine attempt — GENERAL, no type knowledge:
 *  attempt 1 → the discriminating CONTENT words only (drops rambling/question scaffolding, which
 *              is exactly how an 81-year-old speaks: "נו, כמה זה עולה, הבושם ההוא של שאנל" → "בושם שאנל").
 *  attempt 2 → the two longest content words as a tight phrase (last resort).
 * Falls back to the original when there is nothing to tighten.
 */
export function reformulate(query: string, attempt: number): string {
  const words = contentWords(query)
  if (attempt >= 2) {
    const longest = [...words].sort((a, b) => b.length - a.length).slice(0, 2)
    return longest.length ? longest.join(' ') : query
  }
  const tightened = words.join(' ').trim()
  return tightened && tightened !== query.trim() ? tightened : query
}

/** Fetch the winning page's text for ONE attempt (general first-wins), or '' if nothing usable. */
async function fetchWinningText(query: string, opts: GeneralSearchOpts, budgetMs: number): Promise<string> {
  const r = await firstWins(query, {
    search: opts.search,
    fetchPage: opts.fetchPage,
    topN: opts.topN ?? 4,
    softBudgetMs: Math.min(opts.softBudgetMs ?? 4000, budgetMs),
    hardCeilingMs: budgetMs,
    ...(opts.now ? { now: opts.now } : {}),
  })
  // Only hand the model SUBSTANTIAL text — a tiny "best known" fallback page is not worth a
  // model call (and would risk a confident answer from almost nothing). The general content
  // screen already requires ≥200 chars for a real hit; this guards the best-known fallback path.
  return r.ok && r.answer.length >= 150 ? r.answer : ''
}

/** Run the general loop. Never throws — any failure degrades to an honest no_answer. */
export async function generalSearchLoop(query: string, opts: GeneralSearchOpts): Promise<GeneralSearchResult> {
  const now = opts.now ?? (() => Date.now())
  const hard = opts.hardCeilingMs ?? 6000
  const minSlice = opts.minAttemptSliceMs ?? 1800
  const synthReserve = opts.synthReserveMs ?? 1800
  const maxAttempts = Math.max(1, Math.min(opts.maxAttempts ?? 2, 3))
  const t0 = now()
  const queriesTried: string[] = []
  let attempts = 0

  for (let i = 0; i < maxAttempts; i++) {
    const elapsed = now() - t0
    const remaining = hard - elapsed
    // Only START an attempt (beyond the first) if enough of the ceiling remains.
    if (i > 0 && remaining < minSlice) break
    const q = i === 0 ? query : reformulate(query, i)
    // If a reformulation produced nothing new, do not waste an attempt on the identical query.
    if (i > 0 && queriesTried.includes(q)) continue
    queriesTried.push(q)
    attempts++
    try {
      // Reserve time for the judge so fetch + judge together stay within the ceiling.
      const pageText = await fetchWinningText(q, opts, Math.max(500, remaining - synthReserve))
      if (pageText.trim()) {
        const syn = await opts.synthesize(query, pageText) // JUDGE+SYNTH on the ORIGINAL question
        if (syn.status === 'answer' && syn.answer.trim()) {
          return { status: 'answer', answer: syn.answer.trim(), attempts, queriesTried, ms: Math.round(now() - t0), timedOut: false }
        }
      }
    } catch { /* a failed attempt is not fatal — refine or honest-miss */ }
  }

  const ms = Math.round(now() - t0)
  return { status: 'no_answer', answer: '', attempts, queriesTried, ms, timedOut: ms >= hard }
}
