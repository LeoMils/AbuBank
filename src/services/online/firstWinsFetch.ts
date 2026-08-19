/*
 * firstWinsFetch.ts — the OnlineFetch seam backed by first-wins PAGE fetch.
 * ════════════════════════════════════════════════════════════════════════════
 * Wraps firstWins() with real seams: search via the tested Brave adapter (top result
 * URLs), page fetch via `fetch` with a per-page timeout + the shared abort signal (so the
 * losers are actually cancelled). Returns the live path's OnlineAnswer shape — CONTENT
 * only (never a URL or source title; the live tool forbids naming a source and scrubs the
 * text anyway). This is the SAME first-wins module the live endpoint uses, so the eval
 * instrument measures the real capability, not a parallel one.
 */
import { generalSearchLoop } from './generalSearch'
import { braveProvider } from './adapters'
import { synthesizeAnswer } from './synthesize'
import type { OnlineAnswer, OnlineFetch } from '../liveTools'

const BROWSERISH_UA = 'Mozilla/5.0 (compatible; AbuBank/1.0; +https://abubank)'

export interface FirstWinsFetchOpts {
  braveKey?: string
  /** When present, fetched text is SYNTHESIZED to one clean answer (never a raw dump); a
   *  no_answer becomes an honest miss. Without it, the raw page/snippet is returned (legacy). */
  openaiKey?: string
  fetchImpl?: typeof fetch
  topN?: number
  softBudgetMs?: number
  hardCeilingMs?: number
  perPageMs?: number
}

/** Build an OnlineFetch that answers from fetched PAGE content (first-wins), not a snippet. */
export function firstWinsOnlineFetch(opts: FirstWinsFetchOpts = {}): OnlineFetch {
  const doFetch = opts.fetchImpl ?? fetch
  const perPageMs = opts.perPageMs ?? 3500

  const fetchPage = async (url: string, signal: AbortSignal): Promise<string> => {
    const per = new AbortController()
    const onAbort = () => per.abort()
    if (signal.aborted) per.abort()
    signal.addEventListener('abort', onAbort)
    const timer = setTimeout(() => per.abort(), perPageMs)
    try {
      const res = await doFetch(url, { signal: per.signal, headers: { 'User-Agent': BROWSERISH_UA, Accept: 'text/html,*/*' } })
      if (!res.ok) throw new Error(`http ${res.status}`)
      const ct = res.headers.get('content-type') ?? ''
      if (ct && !/text\/html|text\/plain|application\/xhtml/i.test(ct)) throw new Error('non-html')
      return await res.text()
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }
  }

  const MISS = 'לא הצלחתי לבדוק מידע עדכני כרגע.'
  return async (query: string): Promise<OnlineAnswer> => {
    try {
      if (!opts.braveKey) return { ok: false, userMessage: MISS }
      const braveKey = opts.braveKey
      // The GENERAL loop searches (per attempt, so a refine re-searches), fetches pages first-wins,
      // and lets the cheap-model JUDGE decide + synthesize — one path for EVERY question, no
      // per-topic gate. The search seam also captures the first snippet for the "never worse than
      // the snippet" fallback (e.g. a JS-rendered listing whose static HTML has no film list).
      let firstSnippet = ''
      const search = async (q: string) => {
        const searched = await braveProvider.search(q, 'he', { BRAVE_API_KEY: braveKey })
        if (!firstSnippet) firstSnippet = searched.sources.map((s) => s.content).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
        return searched.sources.map((s) => (s.title ? { url: s.url, title: s.title } : { url: s.url }))
      }

      // Without a model there is no general judge → fall back to the raw first snippet (legacy).
      if (!opts.openaiKey) {
        await search(query)
        return firstSnippet ? { ok: true, answer: firstSnippet.slice(0, 1400), sources: [] } : { ok: false, userMessage: MISS }
      }
      const openaiKey = opts.openaiKey
      const synthesize = (originalQuery: string, pageText: string) =>
        synthesizeAnswer(originalQuery, pageText, { openaiKey, fetchImpl: doFetch })

      const r = await generalSearchLoop(query, {
        search, fetchPage, synthesize,
        topN: opts.topN ?? 4,
        softBudgetMs: opts.softBudgetMs ?? 4000,
        hardCeilingMs: opts.hardCeilingMs ?? 6000,
      })
      if (r.status === 'answer' && r.answer) return { ok: true, answer: r.answer, sources: [] }

      // NEVER WORSE THAN THE SNIPPET: if page-fetch found nothing usable (JS-rendered pages), run
      // the search snippet through the same general judge before an honest miss.
      if (firstSnippet) {
        const syn = await synthesizeAnswer(query, firstSnippet, { openaiKey, fetchImpl: doFetch })
        if (syn.status === 'answer' && syn.answer) return { ok: true, answer: syn.answer, sources: [] }
      }
      return { ok: false, userMessage: MISS }
    } catch {
      return { ok: false, userMessage: MISS }
    }
  }
}
