/*
 * onlineWinnerPath.test.ts — the /api/abuai-online bake-off winner path (M2).
 * ════════════════════════════════════════════════════════════════════════════
 * The empirical tournament (docs/eval/ONLINE_BAKEOFF.json, real keyed run) chose
 * Tavily over the incumbent OpenAI (100% vs 61% citation; ~2s vs 3.9s avg / 8.85s p95;
 * a clean speakable Hebrew answer). This proves the endpoint routes to the selected
 * provider (ONLINE_PROVIDER=tavily) AND still enforces the SAME honesty gate: zero
 * sources ⇒ decline, never speak an ungrounded answer. Default (no env) stays OpenAI —
 * covered by onlineGroundingGate.test.ts, which this must not disturb.
 *
 * Evidence: CODE / AUTOMATED_TEST (handler run with a mocked provider). The live
 * numbers are PREVIEW-class and live in ONLINE_BAKEOFF.json / the milestone log.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import handler from '../../api/abuai-online'

function req(body: unknown): Request {
  return new Request('http://localhost/api/abuai-online', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}
function setEnv(env: Record<string, string>) {
  ;(globalThis as unknown as { process: { env: Record<string, string> } }).process = { env }
}
function tavilyResponse(answer: string, results: Array<{ url: string; title?: string }>) {
  return new Response(JSON.stringify({ answer, results }), { status: 200 })
}

describe('online endpoint — bake-off winner path (ONLINE_PROVIDER=tavily)', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('routes to Tavily and returns its grounded answer + sources', async () => {
    setEnv({ ONLINE_PROVIDER: 'tavily', TAVILY_API_KEY: 'k' })
    const fetchSpy = vi.fn(async (..._a: unknown[]) => tavilyResponse('הדולר נסחר היום בכ-3.00 שקלים.', [{ url: 'https://boi.example', title: 'בנק ישראל' }]))
    vi.stubGlobal('fetch', fetchSpy)
    const res = await handler(req({ query: 'כמה עולה דולר היום', lang: 'he' }))
    const j = await res.json() as { ok: boolean; answer?: string; sources?: Array<{ url: string }> }
    expect(j.ok).toBe(true)
    expect(j.answer).toContain('דולר')
    expect(j.sources?.[0]!.url).toBe('https://boi.example')
    // It called Tavily, NOT OpenAI.
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('api.tavily.com')
  })

  it('honesty gate holds on the winner path: zero sources ⇒ ONLINE_NO_RESULTS, no leaked text', async () => {
    setEnv({ ONLINE_PROVIDER: 'tavily', TAVILY_API_KEY: 'k' })
    vi.stubGlobal('fetch', vi.fn(async () => tavilyResponse('משהו שאולי הומצא.', [])))
    const res = await handler(req({ query: 'מי ניצח אתמול', lang: 'he' }))
    const j = await res.json() as { ok: boolean; errorCode?: string; answer?: string; userMessage?: string }
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('ONLINE_NO_RESULTS')
    expect(j.answer).toBeUndefined()
    expect(j.userMessage).not.toContain('הומצא')
  })

  it('a missing winner key is an honest failure, never a silent OpenAI fallback', async () => {
    setEnv({ ONLINE_PROVIDER: 'tavily' }) // no TAVILY_API_KEY
    const fetchSpy = vi.fn(async () => tavilyResponse('x', [{ url: 'https://a' }]))
    vi.stubGlobal('fetch', fetchSpy)
    const res = await handler(req({ query: 'מה החדשות היום', lang: 'he' }))
    const j = await res.json() as { ok: boolean; errorCode?: string }
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('ONLINE_PROVIDER_FAILED')
    expect(fetchSpy).not.toHaveBeenCalled() // never reached the network
  })

  it('the personal guard still blocks family/calendar queries before any provider runs', async () => {
    setEnv({ ONLINE_PROVIDER: 'tavily', TAVILY_API_KEY: 'k' })
    const fetchSpy = vi.fn(async () => tavilyResponse('x', [{ url: 'https://a' }]))
    vi.stubGlobal('fetch', fetchSpy)
    const res = await handler(req({ query: 'מה יש לי ביומן מחר', lang: 'he' }))
    const j = await res.json() as { ok: boolean; errorCode?: string }
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('ONLINE_QUERY_BLOCKED_PERSONAL')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
