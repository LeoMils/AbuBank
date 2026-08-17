/*
 * liveFacts.test.ts — TEMPORAL = GROUNDED + FRESH (dated authoritative live sources).
 * Proves: precise domain classification; dated weather/FX answers carry a freshness anchor;
 * stale/failed sources DECLINE (never a stale value); and the FX mis-extraction CLASS is
 * structurally impossible — an FX value comes from the authoritative API, never page text.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyLiveDomain, resolveWeather, resolveFx, resolveLiveFact } from './liveFacts'
import { evaluateFreshness } from '../../engineering-os/temporalFreshness'

const NOW = '2026-08-17T00:00:00Z'

function mockFetch(handler: (url: string) => { ok: boolean; json: unknown } | null) {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const res = handler(String(input))
    if (!res) return { ok: false, status: 500, json: async () => ({}) } as unknown as Response
    return { ok: res.ok, status: res.ok ? 200 : 500, json: async () => res.json } as unknown as Response
  }))
}

afterEach(() => vi.restoreAllMocks())

describe('classifyLiveDomain — precise, does not over-claim', () => {
  it('weather / fx are detected', () => {
    expect(classifyLiveDomain('מה מזג האוויר עכשיו בכפר סבא?')).toBe('weather')
    expect(classifyLiveDomain('what is the weather now')).toBe('weather')
    expect(classifyLiveDomain('מה שער הדולר היום?')).toBe('fx')
    expect(classifyLiveDomain('exchange rate usd to ils')).toBe('fx')
  })
  it('latest RESULT is a freshness-gated domain only WITH a recency marker', () => {
    expect(classifyLiveDomain('מי ניצח בסופרבול האחרון?')).toBe('result')
    expect(classifyLiveDomain('who won the last super bowl')).toBe('result')
    // A historical result (no recency) is NOT a live-fact domain — keep the normal grounded path.
    expect(classifyLiveDomain('who won the 2010 world cup')).toBeNull()
  })
  it('does NOT claim slow-fact / listing / price queries (they keep the existing path)', () => {
    expect(classifyLiveDomain('מי ראש הממשלה של ישראל עכשיו?')).toBeNull()   // office-holder (slow)
    expect(classifyLiveDomain('אילו סרטים מוקרנים עכשיו בקולנוע?')).toBeNull() // cinema listing
    expect(classifyLiveDomain('כמה עולה בושם בלו דה שאנל?')).toBeNull()        // price (no currency-rate intent)
    expect(classifyLiveDomain('כמה גבוה האוורסט?')).toBeNull()                 // static
  })
})

describe('weather — dated, fresh, or honest decline', () => {
  it('answers with the current temperature + observation time; evidence certifies FRESH', async () => {
    mockFetch((u) => u.includes('open-meteo') ? { ok: true, json: { utc_offset_seconds: 10800, current: { time: '2026-08-16T23:45', temperature_2m: 25.2, weather_code: 2 } } } : null)
    const r = await resolveWeather('מה מזג האוויר עכשיו?', 'he', NOW)
    expect(r.kind).toBe('answer')
    if (r.kind !== 'answer') return
    expect(r.answer).toMatch(/25°/)
    expect(r.answer).toMatch(/כפר סבא/)
    expect(r.evidence.observedAt).toBe('2026-08-16T23:45:00+03:00')
    const fresh = evaluateFreshness({ query: 'מזג האוויר עכשיו', answered: true, nowIso: NOW, sourceDatesIso: [r.evidence.observedAt], maxAgeDays: r.evidence.maxAgeDays })
    expect(fresh.verdict).toBe('FRESH')
    expect(fresh.satisfiesCurrentInfoClaim).toBe(true)
  })
  it('declines honestly when the weather source is unavailable (never invents a value)', async () => {
    mockFetch(() => null)
    const r = await resolveWeather('מה מזג האוויר?', 'he', NOW)
    expect(r.kind).toBe('decline')
  })
})

describe('FX — authoritative dated ECB rate; the mis-extraction class is structurally gone', () => {
  it('answers with the API rate + its date; evidence certifies FRESH', async () => {
    mockFetch((u) => u.includes('frankfurter') ? { ok: true, json: { base: 'USD', date: '2026-08-14', rates: { ILS: 2.9496 } } } : null)
    const r = await resolveFx('מה שער הדולר היום?', 'he', NOW)
    expect(r.kind).toBe('answer')
    if (r.kind !== 'answer') return
    expect(r.answer).toMatch(/2\.95/)               // rounded ECB value — NOT a scraped page number
    expect(r.answer).toMatch(/2026-08-14/)          // the value's date is stated (freshness visible)
    const fresh = evaluateFreshness({ query: 'שער הדולר היום', answered: true, nowIso: NOW, sourceDatesIso: [r.evidence.observedAt], maxAgeDays: r.evidence.maxAgeDays })
    expect(fresh.verdict).toBe('FRESH')
  })
  it('ADVERSARIAL: a scraped page with a plausible-but-wrong number can NEVER become the FX answer', async () => {
    // The endpoint's page-judge path could mis-extract "600 ₪" / "2.10" off some page. The FX resolver
    // does not read pages — it only trusts the authoritative rate API. So a wrong page number cannot
    // surface. Here the ONLY fetch that returns data is the FX API; any page fetch is ignored entirely.
    const pageCalls: string[] = []
    mockFetch((u) => {
      if (u.includes('frankfurter')) return { ok: true, json: { base: 'USD', date: '2026-08-14', rates: { ILS: 2.9496 } } }
      pageCalls.push(u); return { ok: true, json: { text: 'טווח מחירים עד 600 ₪ · דולר 2.10' } }
    })
    const r = await resolveFx('כמה עולה דולר היום?', 'he', NOW)
    expect(r.kind).toBe('answer')
    if (r.kind !== 'answer') return
    expect(r.answer).not.toMatch(/600|2\.10/)       // the junk page numbers never appear
    expect(r.answer).toMatch(/2\.95/)               // only the authoritative rate
    expect(pageCalls.length).toBe(0)                // the FX path fetches NO arbitrary pages
  })
  it('falls back to the second dated source (open.er-api) when frankfurter is unavailable', async () => {
    mockFetch((u) => {
      if (u.includes('frankfurter')) return null                                   // primary down
      if (u.includes('er-api')) return { ok: true, json: { result: 'success', time_last_update_utc: 'Sun, 16 Aug 2026 00:02:31 +0000', base_code: 'USD', rates: { ILS: 2.95 } } }
      return null
    })
    const r = await resolveFx('מה שער הדולר היום?', 'he', NOW)
    expect(r.kind).toBe('answer')
    if (r.kind !== 'answer') return
    expect(r.answer).toMatch(/2\.95/)
    expect(r.answer).toMatch(/2026-08-16/)   // the fallback source's update date
  })
  it('declines when the ECB rate is too old (weekend/holiday gap exceeded)', async () => {
    mockFetch((u) => u.includes('frankfurter') ? { ok: true, json: { base: 'USD', date: '2026-07-01', rates: { ILS: 3.6 } } } : null)
    const r = await resolveFx('שער הדולר היום', 'he', NOW)   // 2026-07-01 is >5d before NOW
    expect(r.kind).toBe('decline')
  })
})

describe('resolveLiveFact — routing + honest decline for undatable results', () => {
  it('non-live-fact queries hand back to the existing path', async () => {
    expect((await resolveLiveFact('מי ראש הממשלה עכשיו?', 'he', NOW)).kind).toBe('not_live_fact')
  })
  it('latest RESULT declines (no dated source) rather than return a possibly-stale grounded value', async () => {
    const r = await resolveLiveFact('מי ניצח בסופרבול האחרון?', 'he', NOW)
    expect(r.kind).toBe('decline')
    if (r.kind === 'decline') expect(r.domain).toBe('result')
  })
})
