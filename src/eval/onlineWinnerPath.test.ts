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

  // Mock the snippet-judge's OpenAI synthesize call (the winner path judges every spoken answer).
  const openaiSynth = (answer: string) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ status: 'answer', answer }) } }] }), { status: 200 })

  it('routes to Tavily and returns its grounded answer + sources', async () => {
    // Non-live-fact current query (cinema listings) — exercises the provider path. FX/weather now
    // route to dedicated dated live-fact sources (liveFacts.ts), not the general provider path.
    // DEEP_FETCH off → the snippet judge runs; mock its OpenAI call so the winner answer is spoken.
    setEnv({ ONLINE_PROVIDER: 'tavily', TAVILY_API_KEY: 'k', OPENAI_API_KEY: 'k', ONLINE_DEEP_FETCH: '0' })
    const fetchSpy = vi.fn(async (url: unknown) => String(url).includes('api.openai.com')
      ? openaiSynth('היום מוקרנים כמה סרטים חדשים בקולנוע.')
      : tavilyResponse('cinema', [{ url: 'https://cinema.example', title: 'קולנוע' }]))
    vi.stubGlobal('fetch', fetchSpy)
    const res = await handler(req({ query: 'אילו סרטים מוקרנים היום בקולנוע', lang: 'he' }))
    const j = await res.json() as { ok: boolean; answer?: string; sources?: Array<{ url: string }> }
    expect(j.ok).toBe(true)
    expect(j.answer).toContain('סרטים')
    expect(j.sources?.[0]!.url).toBe('https://cinema.example')
    // It called Tavily first (provider search), NOT OpenAI.
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

  // ── The diagnostic: a misconfigured provider must NEVER look like an empty search ──
  it('diag reports the SELECTED provider + key present + reached on the winner happy path', async () => {
    setEnv({ ONLINE_PROVIDER: 'tavily', TAVILY_API_KEY: 'k', OPENAI_API_KEY: 'k', ONLINE_DEEP_FETCH: '0' })
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => String(url).includes('api.openai.com')
      ? openaiSynth('היום מוקרנים סרטים חדשים.')
      : tavilyResponse('cinema', [{ url: 'https://cinema.example', title: 'קולנוע' }])))
    const res = await handler(req({ query: 'אילו סרטים מוקרנים היום בקולנוע', lang: 'he' }))
    const j = await res.json() as { ok: boolean; diag?: Record<string, unknown> }
    expect(j.diag).toBeDefined()
    expect(j.diag!.requested).toBe('tavily')
    expect(j.diag!.provider).toBe('tavily')
    expect(j.diag!.providerKeyPresent).toBe(true)
    expect(j.diag!.reached).toBe(true)
    expect(j.diag!.sourceCount).toBe(1)
    expect(j.diag!.outcome).toBe('ok')
  })

  it('diag distinguishes a MISSING winner key (reached:false) from an empty search (reached:true, sourceCount:0)', async () => {
    // Missing key → never reached the provider.
    setEnv({ ONLINE_PROVIDER: 'tavily' })
    vi.stubGlobal('fetch', vi.fn(async () => tavilyResponse('x', [{ url: 'https://a' }])))
    let j = await (await handler(req({ query: 'מה החדשות היום', lang: 'he' }))).json() as { diag?: Record<string, unknown> }
    expect(j.diag!.provider).toBe('tavily')
    expect(j.diag!.providerKeyPresent).toBe(false)
    expect(j.diag!.reached).toBe(false)
    expect(j.diag!.outcome).toBe('ONLINE_PROVIDER_FAILED')

    // Key present but genuinely empty → reached the provider, zero sources.
    setEnv({ ONLINE_PROVIDER: 'tavily', TAVILY_API_KEY: 'k' })
    vi.stubGlobal('fetch', vi.fn(async () => tavilyResponse('', [])))
    j = await (await handler(req({ query: 'מי ניצח אתמול', lang: 'he' }))).json() as { diag?: Record<string, unknown> }
    expect(j.diag!.providerKeyPresent).toBe(true)
    expect(j.diag!.reached).toBe(true)
    expect(j.diag!.sourceCount).toBe(0)
    expect(j.diag!.outcome).toBe('ONLINE_NO_RESULTS')
  })

  it('diag shows requested:unset when ONLINE_PROVIDER is not set (defaulted to openai)', async () => {
    setEnv({ OPENAI_API_KEY: 'k' }) // no ONLINE_PROVIDER
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ output_text: 'x', output: [] }), { status: 200 })))
    // Non-live-fact query (cinema) so it exercises the OpenAI path, not the dated live-fact gate.
    const j = await (await handler(req({ query: 'אילו סרטים מוקרנים היום בקולנוע', lang: 'he' }))).json() as { diag?: Record<string, unknown> }
    expect(j.diag!.requested).toBe('unset')
    expect(j.diag!.provider).toBe('openai')
    expect(j.diag!.openaiKeyPresent).toBe(true)
    expect(j.diag!.reached).toBe(true)
    expect(j.diag!.outcome).toBe('ONLINE_NO_RESULTS') // 0 sources → honest decline
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
