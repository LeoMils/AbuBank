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
import { firstWins } from './firstWins'
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

  return async (query: string): Promise<OnlineAnswer> => {
    try {
      if (!opts.braveKey) return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
      // ONE search up front: its URLs feed first-wins, and its snippets are the fallback.
      const searched = await braveProvider.search(query, 'he', { BRAVE_API_KEY: opts.braveKey })
      const sources = searched.sources
      const snippet = sources.map((s) => s.content).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

      const r = await firstWins(query, {
        search: async () => sources.map((s) => (s.title ? { url: s.url, title: s.title } : { url: s.url })),
        fetchPage,
        topN: opts.topN ?? 4,
        softBudgetMs: opts.softBudgetMs ?? 4000,
        hardCeilingMs: opts.hardCeilingMs ?? 6000,
      })
      // Use PAGE content when a page actually contained the answer (r.hadAnswer) — the depth win;
      // else fall back to the search SNIPPET (never WORSE than before on e.g. a JS-rendered cinema
      // listing). Either way, if we can SYNTHESIZE, hand the model ONE clean answer, never a raw
      // dump — and a synthesis no_answer is an honest miss, not a partial dump.
      const raw = (r.ok && r.hadAnswer && r.answer) ? r.answer : snippet
      if (!raw) return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
      if (opts.openaiKey) {
        const syn = await synthesizeAnswer(query, raw, { openaiKey: opts.openaiKey, fetchImpl: doFetch })
        if (syn.status === 'answer' && syn.answer) return { ok: true, answer: syn.answer, sources: [] }
        return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
      }
      return { ok: true, answer: raw, sources: [] }
    } catch {
      return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
    }
  }
}
