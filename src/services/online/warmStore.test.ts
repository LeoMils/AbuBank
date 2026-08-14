/*
 * warmStore.test.ts — M4 prefetch warm store (Layer 1, injected clock + fetch, no network).
 * Proves: a warm+fresh topic serves with ZERO network calls (the <1s path); stale/miss/one-off
 * fall through to the live fetch and populate; a miss is never cached.
 */
import { describe, it, expect, vi } from 'vitest'
import { WarmStore, serveWarm, topicOf, prefetchWarmTopics, WARM_TTL_MS } from './warmStore'
import type { OnlineAnswer } from '../liveTools'

const ok = (a: string): OnlineAnswer => ({ ok: true, answer: a, sources: [] })
const miss: OnlineAnswer = { ok: false, userMessage: 'no' }

describe('topicOf', () => {
  it('classifies the warm topics and leaves one-offs null', () => {
    expect(topicOf('איזה סרטים רצים בכפר סבא היום?')).toBe('cinema')
    expect(topicOf('מה מזג האוויר?')).toBe('weather')
    expect(topicOf('מה החדשות היום?')).toBe('headlines')
    expect(topicOf('מתי מגיע האוטובוס?')).toBe('transit')
    expect(topicOf('כמה עולה בלו דה שאנל?')).toBeNull()
  })
})

describe('serveWarm', () => {
  it('serves WARM with zero network calls when the topic is cached and fresh', async () => {
    let t = 1_000_000
    const store = new WarmStore(() => t)
    store.put('cinema', ok('גבעה 338, הדרדסים'))
    const live = vi.fn(async () => ok('LIVE'))
    const r = await serveWarm('איזה סרטים רצים היום?', store, live)
    expect(r.served).toBe('warm')
    expect(r.answer.answer).toContain('גבעה 338')
    expect(live).not.toHaveBeenCalled() // the <1s path: no network
  })

  it('falls through to live when stale, and repopulates', async () => {
    let t = 1_000_000
    const store = new WarmStore(() => t)
    store.put('cinema', ok('OLD'))
    t += WARM_TTL_MS.cinema + 1 // now stale
    const live = vi.fn(async () => ok('FRESH'))
    const r = await serveWarm('סרטים היום?', store, live)
    expect(r.served).toBe('live')
    expect(live).toHaveBeenCalledOnce()
    expect(store.getFresh('cinema')?.answer).toBe('FRESH') // repopulated
  })

  it('a one-off (non-topic) query always goes live and is not cached', async () => {
    const store = new WarmStore(() => 5)
    const live = vi.fn(async () => ok('price'))
    const r = await serveWarm('כמה עולה בלו דה שאנל?', store, live)
    expect(r.served).toBe('live')
    expect(r.topic).toBeNull()
  })

  it('never caches a miss (so a later query retries live, not a cached failure)', async () => {
    const store = new WarmStore(() => 5)
    await serveWarm('סרטים?', store, async () => miss)
    expect(store.getFresh('cinema')).toBeNull()
  })
})

describe('prefetchWarmTopics', () => {
  it('warms every requested topic best-effort (a failing topic is skipped, not fatal)', async () => {
    const store = new WarmStore(() => 5)
    const live = vi.fn(async (q: string) => (/סרט/.test(q) ? ok('films') : miss))
    await prefetchWarmTopics(store, live, ['cinema', 'weather'])
    expect(store.getFresh('cinema')?.answer).toBe('films')
    expect(store.getFresh('weather')).toBeNull() // weather returned a miss → not cached
  })
})
