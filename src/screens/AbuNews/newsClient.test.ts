/*
 * newsClient.test.ts — the client never trusts the wire and never fabricates.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { fetchNews, getCachedNews, __resetNewsCache } from './newsClient'

const FULL = { headline: 'כותרת', summary: 'תקציר פשוט.', source: 'הארץ', url: 'https://haaretz.example/a', published: 'לפני שעה' }
const stubFetch = (body: unknown, ok = true) =>
  (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as unknown as typeof fetch

beforeEach(() => __resetNewsCache())

describe('fetchNews — grounded stories only', () => {
  it('returns grounded stories and caches them for Abu to speak from', async () => {
    const r = await fetchNews({ fetchImpl: stubFetch({ ok: true, stories: [FULL], retrievedAt: '2026-08-11T09:00:00.000Z' }) })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.stories).toHaveLength(1)
      expect(r.stories[0]!.source).toBe('הארץ')
    }
    expect(getCachedNews()?.stories).toHaveLength(1) // the SAME results, for the live path
  })

  it('drops half-blank stories from the wire (never trusts it)', async () => {
    const r = await fetchNews({ fetchImpl: stubFetch({ ok: true, stories: [FULL, { ...FULL, source: '' }, { ...FULL, url: 'nope' }] }) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.stories).toHaveLength(1) // only the complete one survives
  })

  it('if nothing grounded survives → honest failure, no stories, no cache', async () => {
    const r = await fetchNews({ fetchImpl: stubFetch({ ok: true, stories: [{ ...FULL, source: '' }] }) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('NEWS_NO_RESULTS')
    expect(getCachedNews()).toBeNull()
  })

  it('passes through an honest server failure', async () => {
    const r = await fetchNews({ fetchImpl: stubFetch({ ok: false, errorCode: 'NEWS_TIMEOUT', userMessage: 'לקח יותר מדי זמן' }) })
    expect(r.ok).toBe(false)
    if (!r.ok) { expect(r.errorCode).toBe('NEWS_TIMEOUT'); expect(r.userMessage).toContain('זמן') }
  })

  it('a thrown fetch → honest failure, never invented', async () => {
    const r = await fetchNews({ fetchImpl: (async () => { throw new Error('offline') }) as unknown as typeof fetch })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.userMessage.length).toBeGreaterThan(0)
  })
})
