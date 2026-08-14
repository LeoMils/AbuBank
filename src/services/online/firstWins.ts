/*
 * firstWins.ts — agent A (online DEPTH): fetch result PAGES, answer from the FIRST that
 * actually contains the answer, cancel the rest.
 * ════════════════════════════════════════════════════════════════════════════
 * The price gap's root cause: the online path spoke from a search SNIPPET (a title +
 * one-line description), which rarely carries a real price. This fetches the top result
 * PAGES in parallel, extracts readable text, and returns the FIRST page whose text
 * actually contains the answer (for a price query: a real price token) — aborting the
 * others the instant one wins. Budgeted: a soft first-wins target and a hard ceiling
 * after which it returns what is known (best page so far) rather than keep waiting.
 *
 * Pure over injected seams (search + fetchPage), so ONE module serves both the live
 * endpoint (api/abuai-online) and the eval harness — no second online path — and the
 * winner/abort/budget logic is unit-tested with fakes, no network.
 */

export interface FwSource { title?: string; url: string }
export interface FirstWinsResult {
  ok: boolean
  /** Cleaned, bounded page text of the WINNING page — grounded CONTENT (not a snippet),
   *  handed to the model to speak from. Empty when nothing usable was fetched. */
  answer: string
  winningUrl?: string
  pagesFetched: number
  hadAnswer: boolean   // did a page actually contain the answer (vs "best known" fallback)?
  timedOut: boolean    // hit the hard ceiling
  ms: number
}

export interface FirstWinsOpts {
  /** Real search seam → top result URLs (already ranked). */
  search: (query: string) => Promise<FwSource[]>
  /** Real page fetch → raw HTML/text; MUST honour the AbortSignal (cancel the losers). */
  fetchPage: (url: string, signal: AbortSignal) => Promise<string>
  /** Does this readable page text contain the answer to the query? Default: price-aware. */
  hasAnswer?: (readableText: string, query: string) => boolean
  /** Reduce a winning page to the salient, bounded grounded snippet. Default: price-aware. */
  extract?: (readableText: string, query: string) => string
  topN?: number            // pages fetched in parallel (default 4)
  softBudgetMs?: number    // first-wins target (default 4000)
  hardCeilingMs?: number   // return-what-is-known ceiling (default 6000)
  now?: () => number
}

/** Strip HTML to readable text: drop script/style/noscript, tags → space, decode the
 *  common entities, collapse whitespace. Bounded so a huge page cannot blow the budget. */
export function htmlToText(html: string, maxChars = 20_000): string {
  const t = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)) } catch { return ' ' } })
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
  return t.length > maxChars ? t.slice(0, maxChars) : t
}

/** A price question in Hebrew / Spanish / English. */
export function isPriceQuery(query: string): boolean {
  return /כמה\s*עולה|כמה\s*זה\s*עולה|המחיר|מחיר\s|בכמה|price|how much|cu[aá]nto\s+(?:cuesta|sale|vale)|precio/i.test(query)
}

/** A real price token: a currency symbol/word adjacent to a number (either order). */
const PRICE_TOKEN = /(?:₪|\$|€|£)\s?\d[\d.,]*|\d[\d.,]*\s?(?:₪|\$|€|£|ש["״]?ח|שקל(?:ים)?|ILS|USD|EUR|dollars?|euros?|shekels?)/i

/** Words that carry no product identity — dropped so the discriminating product name remains. */
const QUERY_STOP = new Set(['כמה', 'עולה', 'המחיר', 'מחיר', 'בכמה', 'זה', 'של', 'דה', 'the', 'how', 'much', 'price', 'cost', 'cuanto', 'cuánto', 'cuesta', 'vale', 'precio', 'de'])

/** The discriminating product terms in a query ("כמה עולה בלו דה שאנל" → ["בלו","שאנל"]). */
export function productTerms(query: string): string[] {
  return query.normalize('NFC').replace(/[?？.,!"״]/g, ' ').split(/\s+/)
    .map((w) => w.trim()).filter((w) => w.length >= 3 && !QUERY_STOP.has(w.toLowerCase()))
}

/** For a price query, is there a price token NEAR a product term on the page? The relevance gate:
 *  a store pricing a hundred OTHER perfumes must NOT pass a Chanel query. Requires a price token
 *  within `window` chars of a discriminating product term (the queried entity), not merely
 *  ANY price on the page (the "Clive Christian / Fugazzi prices for a Chanel question" defect). */
export function priceNearProduct(text: string, query: string, window = 160): boolean {
  const terms = productTerms(query)
  if (!terms.length) return PRICE_TOKEN.test(text) // no discriminating term → any price is the best we can require
  const re = new RegExp(PRICE_TOKEN.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const s = Math.max(0, m.index - window), e = Math.min(text.length, m.index + m[0].length + window)
    const win = text.slice(s, e)
    if (terms.some((t) => win.includes(t))) return true
  }
  return false
}

/** Default "does the page contain the answer": for a price query, a real price token BELONGING to
 *  the queried product (proximity); else a non-trivial page that shares a meaningful word. */
export function defaultHasAnswer(text: string, query: string): boolean {
  if (isPriceQuery(query)) return priceNearProduct(text, query)
  if (text.length < 200) return false
  const words = query.replace(/[?？.,!]/g, ' ').split(/\s+/).filter((w) => w.length >= 3)
  return words.some((w) => text.includes(w))
}

/** Default salient extraction: for a price query, stitch the windows around the first few
 *  price tokens (so the model reads a range, not a whole page); else the readable head.
 *  Always bounded (≤ ~1400 chars) so the grounded tool payload stays small. */
export function defaultExtract(text: string, query: string, maxChars = 1400): string {
  if (isPriceQuery(query)) {
    const terms = productTerms(query)
    const near: string[] = []   // price windows that mention the queried product
    const any: string[] = []    // any price window (fallback)
    const re = new RegExp(PRICE_TOKEN.source, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) && any.length < 8) {
      const start = Math.max(0, m.index - 110)
      const end = Math.min(text.length, m.index + m[0].length + 110)
      const w = text.slice(start, end).replace(/\s+/g, ' ').trim()
      any.push(w)
      if (terms.length && terms.some((t) => w.includes(t))) near.push(w)
    }
    const chosen = near.length ? near : any
    if (chosen.length) return chosen.slice(0, 6).join(' … ').slice(0, maxChars)
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, maxChars)
}

/**
 * Fetch the top-N result pages in parallel; resolve with the FIRST page that contains the
 * answer and abort the rest. If none qualifies before the hard ceiling, return the best
 * page fetched so far (longest readable text) marked hadAnswer:false — "what is known".
 * Never throws; a total failure returns ok:false.
 */
export async function firstWins(query: string, opts: FirstWinsOpts): Promise<FirstWinsResult> {
  const now = opts.now ?? (() => Date.now())
  const topN = opts.topN ?? 4
  const soft = opts.softBudgetMs ?? 4000
  const hard = opts.hardCeilingMs ?? 6000
  const hasAnswer = opts.hasAnswer ?? defaultHasAnswer
  const extract = opts.extract ?? defaultExtract
  const t0 = now()
  const done = (r: Omit<FirstWinsResult, 'ms'>): FirstWinsResult => ({ ...r, ms: Math.round(now() - t0) })

  let sources: FwSource[]
  try { sources = await opts.search(query) } catch { sources = [] }
  if (!sources.length) return done({ ok: false, answer: '', pagesFetched: 0, hadAnswer: false, timedOut: false })

  const urls = sources.slice(0, topN)
  const controller = new AbortController()
  let fetched = 0
  let best = '' // best-known readable text if nothing qualifies (return what is known)
  let bestUrl: string | undefined

  return await new Promise<FirstWinsResult>((resolve) => {
    let settled = false
    const finish = (r: FirstWinsResult) => { if (settled) return; settled = true; try { controller.abort() } catch { /* */ } resolve(r) }

    // Hard ceiling: stop waiting, speak what is known.
    const ceiling = setTimeout(() => {
      finish(done({ ok: !!best, answer: best ? extract(best, query) : '', ...(bestUrl ? { winningUrl: bestUrl } : {}), pagesFetched: fetched, hadAnswer: false, timedOut: true }))
    }, hard)

    let pending = urls.length
    for (const s of urls) {
      opts.fetchPage(s.url, controller.signal)
        .then((html) => {
          if (settled) return
          fetched++
          const text = htmlToText(html)
          if (hasAnswer(text, query)) {
            clearTimeout(ceiling)
            finish(done({ ok: true, answer: extract(text, query), winningUrl: s.url, pagesFetched: fetched, hadAnswer: true, timedOut: false }))
            return
          }
          if (text.length > best.length) { best = text; bestUrl = s.url }
        })
        .catch(() => { /* a losing/aborted fetch is fine */ })
        .finally(() => {
          pending--
          void soft // (soft budget is advisory: first-wins already returns the first qualifier)
          if (pending === 0 && !settled) {
            clearTimeout(ceiling)
            finish(done({ ok: !!best, answer: best ? extract(best, query) : '', ...(bestUrl ? { winningUrl: bestUrl } : {}), pagesFetched: fetched, hadAnswer: false, timedOut: false }))
          }
        })
    }
  })
}
