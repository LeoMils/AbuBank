import { describe, it, expect } from 'vitest'
import {
  buildBriefing, detailFor, urlKey, hostOf, speakableBriefing, cleanHeadlineTitle, OFFER_HE,
  BRIEFING_QUERIES, type SearchFn,
} from './briefing'
import type { ProviderResult } from './providerTypes'

// A mock provider: returns N distinct titled+snippeted sources per query, tagged by
// the query so we can see the fan-out and dedup working.
function mockSearch(perQuery = 4): SearchFn {
  return async (query: string): Promise<ProviderResult> => {
    const cat = BRIEFING_QUERIES.find((q) => q.query === query)?.category ?? 'x'
    const sources = Array.from({ length: perQuery }, (_, i) => ({
      url: `https://news.example/${cat}/${i}`,
      title: `${cat} headline ${i}`,
      content: `full snippet for ${cat} item ${i} with real detail`,
    }))
    return { ok: true, answer: `${cat} answer`, sources, latencyMs: 10 }
  }
}

describe('briefing — fan-out across categories, 10+ distinct headlines', () => {
  it('returns 10 or more distinct headlines with sources and snippets', async () => {
    const b = await buildBriefing(mockSearch(4), {})
    expect(b.count).toBeGreaterThanOrEqual(10)
    // every headline has a real title, url, host and (here) a snippet
    for (const h of b.headlines) {
      expect(h.title.length).toBeGreaterThan(0)
      expect(h.url).toMatch(/^https?:\/\//)
      expect(h.host.length).toBeGreaterThan(0)
      expect(h.snippet.length).toBeGreaterThan(0)
    }
  })

  it('covers multiple categories (a briefing is not one topic)', async () => {
    const b = await buildBriefing(mockSearch(4), {})
    expect(b.categoriesCovered.length).toBeGreaterThanOrEqual(4)
  })

  it('offers depth on demand when there are headlines', async () => {
    const b = await buildBriefing(mockSearch(4), {})
    expect(b.offer).toBe(OFFER_HE)
  })

  it('excludes sports and economics even if a query surfaced them', async () => {
    const dirty: SearchFn = async (query) => {
      const cat = BRIEFING_QUERIES.find((q) => q.query === query)?.category ?? 'x'
      return {
        ok: true, latencyMs: 5, answer: '',
        sources: [
          { url: `https://s.example/${cat}/sport`, title: 'מכבי ניצחון בליגה', content: 'כדורגל' },
          { url: `https://s.example/${cat}/econ`, title: 'הבורסה עלתה, מדד המניות', content: 'דולר' },
          { url: `https://s.example/${cat}/ok`, title: `${cat} real headline`, content: 'snippet' },
        ],
      }
    }
    const b = await buildBriefing(dirty, {})
    expect(b.headlines.every((h) => !/מכבי|בורסה|מניות|כדורגל/.test(h.title))).toBe(true)
    expect(b.headlines.some((h) => /real headline/.test(h.title))).toBe(true)
  })

  it('deduplicates the same URL surfaced by two categories', async () => {
    const dup: SearchFn = async () => ({
      ok: true, latencyMs: 5, answer: '',
      sources: [{ url: 'https://dup.example/same', title: 'same story', content: 'x' }],
    })
    const b = await buildBriefing(dup, {})
    const keys = b.headlines.map((h) => urlKey(h.url))
    expect(new Set(keys).size).toBe(keys.length) // all distinct
    expect(b.headlines.length).toBe(1) // one survivor across all categories
  })

  it('a source with no title is never turned into a headline (no source, no claim)', async () => {
    const untitled: SearchFn = async () => ({
      ok: true, latencyMs: 5, answer: '', sources: [{ url: 'https://u.example/x', content: 'snippet only' }],
    })
    const b = await buildBriefing(untitled, {})
    expect(b.count).toBe(0)
    expect(b.offer).toBe('')
  })

  it('a failing category is recorded, not fatal', async () => {
    const flaky: SearchFn = async (query) => {
      const cat = BRIEFING_QUERIES.find((q) => q.query === query)?.category
      if (cat === 'health') return { ok: false, sources: [], latencyMs: 5, error: 'PROVIDER_FAILED' }
      return { ok: true, latencyMs: 5, answer: '', sources: [{ url: `https://f.example/${cat}`, title: `${cat} h`, content: 's' }] }
    }
    const b = await buildBriefing(flaky, {})
    expect(b.categoriesFailed).toContain('health')
    expect(b.count).toBeGreaterThan(0)
  })
})

describe('briefing — depth on demand from held snippets', () => {
  it('detailFor returns the held snippet for an in-range item (no new query)', async () => {
    const b = await buildBriefing(mockSearch(4), {})
    const d = detailFor(b, 1)
    expect(d.ok).toBe(true)
    if (d.ok) {
      expect(d.text.length).toBeGreaterThan(0)
      expect(d.text).toBe(b.headlines[0]!.snippet)
    }
  })

  it('detailFor is honest when the index is out of range', async () => {
    const b = await buildBriefing(mockSearch(4), {})
    const d = detailFor(b, 999)
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toBe('out_of_range')
  })

  it('detailFor says no_detail_held when we hold no snippet (never fabricates)', async () => {
    const noSnippet: SearchFn = async (query) => {
      const cat = BRIEFING_QUERIES.find((q) => q.query === query)?.category
      return { ok: true, latencyMs: 5, answer: '', sources: [{ url: `https://n.example/${cat}`, title: `${cat} h` }] }
    }
    const b = await buildBriefing(noSnippet, {})
    const d = detailFor(b, 1)
    expect(d.ok).toBe(false)
    if (!d.ok) expect(d.reason).toBe('no_detail_held')
  })
})

describe('briefing — helpers', () => {
  it('urlKey normalizes scheme/www/query/trailing slash', () => {
    expect(urlKey('https://www.Example.com/a/?x=1#h')).toBe('example.com/a')
    expect(urlKey('http://example.com/a/')).toBe('example.com/a')
  })
  it('hostOf extracts the host', () => {
    expect(hostOf('https://www.ynet.co.il/news/article/123')).toBe('ynet.co.il')
  })
  it('speakableBriefing numbers each headline and ends with the offer, but NEVER names a source', async () => {
    const b = await buildBriefing(mockSearch(4), {})
    const spoken = speakableBriefing(b)
    expect(spoken).toMatch(/^1\. /)
    expect(spoken).toContain(OFFER_HE)
    // device fix: a briefing must not speak the source — no "(host)" tag, no bare domain.
    expect(spoken).not.toMatch(/\([^)]*\.(?:co\.il|com|net|org)\)/)
    expect(spoken).not.toMatch(/[-\w]+\.(?:co\.il|com|net|org)\b/)
  })

  it('cleanHeadlineTitle strips a trailing source/outlet but keeps the headline', () => {
    expect(cleanHeadlineTitle('חדשות בעולם: עדכונים מרחבי העולם - כאן 11')).toBe('חדשות בעולם: עדכונים מרחבי העולם')
    expect(cleanHeadlineTitle('מחירי הדלק עולים (ynet.co.il)')).toBe('מחירי הדלק עולים')
    expect(cleanHeadlineTitle('כותרת רגילה בלי מקור')).toBe('כותרת רגילה בלי מקור')
  })
})
