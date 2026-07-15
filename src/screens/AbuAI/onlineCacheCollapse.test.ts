/*
 * Regression: online cache must not collapse DIFFERENT questions (Cycle 6, RED-first)
 * ═══════════════════════════════════════════════════════════════════════════════════
 * First divergence: answerOnlineCurrentInfo cached by the COARSE queryKind
 * (getOnlineQueryKind → 'general_current' / 'news' / 'sports' …). Two DIFFERENT questions
 * of the same kind within the 30-min TTL therefore returned the SAME cached answer — the
 * "repeated identical answers to different questions" symptom, provable in CODE.
 *
 * Fix: key the cache by kind + the specific query, so an identical repeat still hits the
 * cache but two different questions never share an answer. Evidence class: CODE (mock fetch).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { answerOnlineCurrentInfo, _clearOnlineCache } from './onlineProvider'

beforeEach(() => { _clearOnlineCache() })

// A fake server that echoes the received query into the answer, so any stale reuse shows.
function echoFetch(): typeof fetch {
  return (async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string }
    const answer = `LIVE for [${body.query ?? ''}]`
    return { ok: true, json: async () => ({ ok: true, answer, sources: [] }) } as unknown as Response
  }) as unknown as typeof fetch
}

describe('online cache does not serve one question\'s answer for a different question', () => {
  it('two different "current office holder" questions get their OWN answers', async () => {
    const f = echoFetch()
    const q1 = 'מי ראש הממשלה של ישראל עכשיו?'
    const q2 = 'מי נשיא ארצות הברית עכשיו?'
    const r1 = await answerOnlineCurrentInfo(q1, { fetchImpl: f, timeoutMs: 50 })
    const r2 = await answerOnlineCurrentInfo(q2, { fetchImpl: f, timeoutMs: 50 })
    expect(r1.ok && r1.answer).toContain('ראש הממשלה')
    expect(r2.ok && r2.answer).toContain('נשיא ארצות הברית')
    // The bug: r2 echoed q1's answer because both map to the same kind.
    expect(r2.ok && r2.answer).not.toContain('ראש הממשלה')
  })

  it('an IDENTICAL repeated question still hits the cache (only one network call)', async () => {
    let calls = 0
    const f = (async (_url: string, init?: RequestInit) => {
      calls++
      const body = JSON.parse(String(init?.body ?? '{}')) as { query?: string }
      return { ok: true, json: async () => ({ ok: true, answer: `LIVE [${body.query}]`, sources: [] }) } as unknown as Response
    }) as unknown as typeof fetch
    const q = 'מה מזג האוויר היום בכפר סבא?'
    const a = await answerOnlineCurrentInfo(q, { fetchImpl: f, timeoutMs: 50 })
    const b = await answerOnlineCurrentInfo(q, { fetchImpl: f, timeoutMs: 50 })
    expect(a.ok && a.answer).toBe(b.ok && b.answer)
    expect(calls).toBe(1) // second identical call served from cache
  })
})
