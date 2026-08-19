/*
 * Online production safety (DETERMINISTIC, provider-mocked).
 *
 * Proves: current-info queries require real grounding (no fabricated freshness),
 * personal queries are blocked client-side (no network), provider/key errors map
 * to safe localized messages (never raw provider output), and sources flow through
 * when present. Uses the fetchImpl hook — no real network.
 */
import { describe, it, expect, vi } from 'vitest'
import { answerOnlineCurrentInfo } from './onlineProvider'

const RAW_LEAK = /[{}]|"errorCode"|sk-|Bearer\s|stack|rate_limit/i
const okFetch = (payload: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch

describe('online: personal queries never go to the network', () => {
  it('a personal/calendar query is blocked client-side (fetch not called)', async () => {
    const spy = vi.fn()
    const r = await answerOnlineCurrentInfo('מה התור שלי מחר אצל הרופא?', { fetchImpl: spy as unknown as typeof fetch })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('ONLINE_QUERY_BLOCKED_PERSONAL')
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('online: real grounding required, sources flow through', () => {
  it('returns the grounded answer + sources when the provider supplies them', async () => {
    const r = await answerOnlineCurrentInfo('מה מזג האוויר היום בכפר סבא במיוחד?', {
      fetchImpl: okFetch({ ok: true, answer: 'היום 27 מעלות, שמשי.', sources: [{ url: 'https://weather.example', title: 'Weather' }] }),
    })
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.answer).toContain('27'); expect(r.sources?.[0]?.url).toContain('weather.example') }
  })

  it('does NOT fabricate freshness when the provider returns no answer', async () => {
    const r = await answerOnlineCurrentInfo('אילו סרטים יש עכשיו בקולנוע ייחודי?', {
      fetchImpl: okFetch({ ok: false, errorCode: 'ONLINE_PROVIDER_FAILED', userMessage: 'אני לא מצליחה לבדוק כרגע.' }),
    })
    expect(r.ok).toBe(false) // honest failure, not an invented listing
    if (!r.ok) { expect(r.userMessage.length).toBeGreaterThan(0); expect(RAW_LEAK.test(r.userMessage)).toBe(false) }
  })
})

describe('online: errors map to safe localized copy (no raw provider output)', () => {
  it('missing key → safe userMessage', async () => {
    const r = await answerOnlineCurrentInfo('מה חדש בעולם בדיוק עכשיו?', {
      fetchImpl: okFetch({ ok: false, errorCode: 'OPENAI_API_KEY_MISSING', userMessage: 'אני לא יכולה לבדוק מידע אונליין כרגע.' }),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(RAW_LEAK.test(r.userMessage)).toBe(false)
  })

  it('network rejection → safe message, never throws', async () => {
    const throwing = (async () => { throw new Error('ECONNREFUSED sk-proj-leak') }) as unknown as typeof fetch
    const r = await answerOnlineCurrentInfo('מה השער של הדולר ממש עכשיו היום?', { fetchImpl: throwing })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(RAW_LEAK.test(r.userMessage)).toBe(false)
  })
})
