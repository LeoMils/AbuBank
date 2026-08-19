/*
 * BRIEFING — a briefing is not one query (Item 3 · online depth).
 * ════════════════════════════════════════════════════════════════════════════
 * The old online path returned a single one-line synthesized answer and threw the
 * rest away, so "what is new" yielded three headlines. This module fans a briefing
 * out across the topics Martita actually wants — Israel, world, culture,
 * entertainment, society, health — deliberately EXCLUDING sports and economics
 * (she does not want them). It merges + deduplicates across categories and returns
 * ten or more DISTINCT headlines, each one line, each with its source and the
 * per-source snippet (DEPTH) held for a follow-up.
 *
 * Pure orchestration over an injected `search` (the provider interface), so it is
 * unit-testable with a mock provider (CODE) and runnable against the real key
 * (PREVIEW). The honesty invariant is preserved: a headline exists only if a real
 * source backs it — no source, no headline, ever.
 */
import type { ProviderResult, Env } from './providerTypes'

export type SearchFn = (query: string, lang: string, env: Env) => Promise<ProviderResult>

export type BriefCategory =
  | 'israel' | 'world' | 'culture' | 'entertainment' | 'society' | 'health'

export interface CategoryQuery { category: BriefCategory; query: string }

/** The fan-out. Hebrew queries (Martita's primary), Kfar Saba / Israel framing.
 *  NO sports, NO economics/markets — excluded by construction AND filtered below. */
export const BRIEFING_QUERIES: CategoryQuery[] = [
  { category: 'israel', query: 'חדשות ישראל היום עדכון' },
  { category: 'world', query: 'חדשות העולם היום עדכון' },
  { category: 'culture', query: 'תרבות ואמנות בישראל היום' },
  { category: 'entertainment', query: 'בידור ותוכניות טלוויזיה חדשות היום' },
  { category: 'society', query: 'חברה וקהילה בישראל חדשות היום' },
  { category: 'health', query: 'בריאות ורפואה טיפים וחדשות היום' },
]

// She explicitly does not want sports or economics — drop any result that is clearly
// one of those even if a general query surfaced it. Conservative token lists.
const EXCLUDE = /כדורגל|כדורסל|ליגה|מכבי|הפועל|ניצחון|הפסד|גביע|אלופ|ספורט|מונדיאל|בורסה|מניות|מדד|דולר|שקל|ריבית|אינפלציה|נאסד|תל.?אביב\s?125|football|soccer|basketball|nasdaq|stocks?|inflation|interest rate/i

export interface Headline {
  title: string
  url: string
  host: string
  snippet: string
  category: BriefCategory
}

export interface Briefing {
  headlines: Headline[]
  count: number
  categoriesCovered: BriefCategory[]
  /** Abu offers depth on demand — answered from the held snippets, not a new query. */
  offer: string
  /** categories whose query failed or returned nothing (honest partial coverage). */
  categoriesFailed: BriefCategory[]
}

export const OFFER_HE = 'רוצה שאפרט על אחד מהם?'

/** Normalize a URL to host+path (drop scheme, query, trailing slash, www) for dedup. */
export function urlKey(url: string): string {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/$/, '')
    .toLowerCase()
}

export function hostOf(url: string): string {
  const k = urlKey(url)
  const slash = k.indexOf('/')
  return slash === -1 ? k : k.slice(0, slash)
}

function isExcluded(title: string, snippet: string): boolean {
  return EXCLUDE.test(title) || EXCLUDE.test(snippet)
}

export interface BuildBriefingOpts {
  lang?: string
  /** max headlines kept per category before the final merge (diversity). */
  perCategory?: number
  /** hard cap on total headlines. */
  max?: number
  /** minimum distinct hosts required for a healthy briefing (else partial). */
  minHosts?: number
}

/**
 * Build a briefing by fanning out across the categories in parallel, then merging
 * and de-duplicating. Never throws — a failed category is recorded, not fatal.
 */
export async function buildBriefing(
  search: SearchFn,
  env: Env,
  opts: BuildBriefingOpts = {},
): Promise<Briefing> {
  const lang = opts.lang ?? 'he'
  const perCategory = opts.perCategory ?? 3
  const max = opts.max ?? 12

  const results = await Promise.all(
    BRIEFING_QUERIES.map(async (cq) => {
      try {
        const r = await search(cq.query, lang, env)
        return { cq, r }
      } catch {
        return { cq, r: { ok: false, sources: [], latencyMs: 0, error: 'PROVIDER_FAILED' } as ProviderResult }
      }
    }),
  )

  const seen = new Set<string>()
  const perCat: Array<{ category: BriefCategory; items: Headline[] }> = []
  const categoriesFailed: BriefCategory[] = []

  for (const { cq, r } of results) {
    if (!r.ok || r.sources.length === 0) { categoriesFailed.push(cq.category); continue }
    const items: Headline[] = []
    for (const s of r.sources) {
      if (items.length >= perCategory) break
      const key = urlKey(s.url)
      if (seen.has(key)) continue
      const title = (s.title ?? '').trim()
      const snippet = (s.content ?? '').trim()
      if (!title) continue // a headline must have a real title from a real source
      if (isExcluded(title, snippet)) continue
      seen.add(key)
      items.push({ title, url: s.url, host: hostOf(s.url), snippet, category: cq.category })
    }
    if (items.length === 0) categoriesFailed.push(cq.category)
    else perCat.push({ category: cq.category, items })
  }

  // Round-robin across categories so the briefing is diverse, not one topic.
  const headlines: Headline[] = []
  let idx = 0
  let added = true
  while (headlines.length < max && added) {
    added = false
    for (const c of perCat) {
      if (c.items[idx]) { headlines.push(c.items[idx]!); added = true; if (headlines.length >= max) break }
    }
    idx++
  }

  const categoriesCovered = [...new Set(headlines.map((h) => h.category))]
  return {
    headlines,
    count: headlines.length,
    categoriesCovered,
    categoriesFailed: [...new Set(categoriesFailed)].filter((c) => !categoriesCovered.includes(c)),
    offer: headlines.length > 0 ? OFFER_HE : '',
  }
}

// ─── Depth on demand (from the SAME retrieval; no new query while we hold it) ──
export type DetailResult =
  | { ok: true; headline: Headline; text: string; source: string }
  | { ok: false; reason: 'out_of_range' | 'no_detail_held'; headline?: Headline }

/**
 * Answer a follow-up ("tell me more about #3") from the held briefing snippets —
 * NOT a new query. If we hold no snippet for that item, say so (the caller may then
 * issue ONE targeted query for that headline; until then we never fabricate depth).
 */
export function detailFor(b: Briefing, indexOneBased: number): DetailResult {
  const h = b.headlines[indexOneBased - 1]
  if (!h) return { ok: false, reason: 'out_of_range' }
  if (!h.snippet) return { ok: false, reason: 'no_detail_held', headline: h }
  return { ok: true, headline: h, text: h.snippet, source: h.host }
}

/** Common Israeli news outlets/broadcasters — a source NAME that must not be spoken (the instruction
 *  forbids naming a source; scrubForSpeech only removes domains, not bare outlet names in a title). */
const OUTLET = /ynet|וואלה|walla|כאן ?11|מאקו|mako|n12|c1[0-9]|כלכליסט|globes|גלובס|הארץ|haaretz|מעריב|ישראל ?היום|israel ?hayom|רשת ?13|reshet|ערוץ ?\d+|the ?marker|דה ?מרקר|הידברות|ויקיפדיה|wikipedia|isramedia|ישראמדיה|medicalnewstoday|\bnews ?today\b/i

/** Strip a trailing source/outlet attribution a search-result title carries — "(domain)", a dangling
 *  separator, or a trailing outlet name ("… - כאן 11", "… | ynet") — so a spoken headline never names
 *  a source. Conservative: only the TRAILING attribution is removed; the headline text is preserved. */
export function cleanHeadlineTitle(title: string): string {
  let t = title.replace(/\s*[([][^)\]]*[)\]]\s*$/g, '')                     // trailing (…)/[…] (usually the source)
  t = t.replace(new RegExp(`(?:${OUTLET.source})`, 'gi'), '')               // outlet name ANYWHERE (start/mid/end)
  t = t.replace(/\s*[-|–—:]\s*(?=[-|–—:]|$)/g, ' ')                         // collapse separators left dangling
  t = t.replace(/^[\s\-|–—:]+|[\s\-|–—:]+$/g, '')                           // trim leading/trailing separators
  t = t.replace(/\s{2,}/g, ' ').trim()
  return t || title.trim()                                                  // never return empty
}

/** A speakable one-line-per-headline briefing for TTS (numbered). NEVER tags a source: the host is
 *  dropped and any trailing outlet name is stripped (device: a briefing must not name where it came from). */
export function speakableBriefing(b: Briefing): string {
  if (b.count === 0) return ''
  const lines = b.headlines.map((h, i) => `${i + 1}. ${cleanHeadlineTitle(h.title)}`)
  return `${lines.join('\n')}\n${b.offer}`
}
