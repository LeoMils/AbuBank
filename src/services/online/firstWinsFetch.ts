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
import type { OnlineAnswer, OnlineFetch } from '../liveTools'

const BROWSERISH_UA = 'Mozilla/5.0 (compatible; AbuBank/1.0; +https://abubank)'

export interface FirstWinsFetchOpts {
  braveKey?: string
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
      // Use PAGE content ONLY when a page actually contained the answer (r.hadAnswer) — that is
      // the depth win (a real price). Otherwise fall back to the search SNIPPET, so a query the
      // page-fetch cannot improve (e.g. a JS-rendered cinema listing) is never WORSE than before.
      if (r.ok && r.hadAnswer && r.answer) return { ok: true, answer: r.answer, sources: [] }
      if (snippet) return { ok: true, answer: snippet, sources: [] }
      return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
    } catch {
      return { ok: false, userMessage: 'לא הצלחתי לבדוק מידע עדכני כרגע.' }
    }
  }
}
