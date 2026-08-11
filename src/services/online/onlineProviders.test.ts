/*
 * onlineProviders.test.ts — the bake-off framework (CODE / MOCK).
 * Locks provider selection, the honesty of "available" (no key ⇒ never runs), the
 * corpus shape, and that each adapter maps its provider's response → ProviderResult.
 * Real provider calls are PROVIDER/PREVIEW — proven by scripts/online-bakeoff, not here.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { selectProvider, providerById, availableProviders, ALL_PROVIDERS } from './registry'
import { openaiProvider, tavilyProvider, braveProvider, perplexityProvider } from './adapters'
import { BAKEOFF_CORPUS } from './corpus'

afterEach(() => vi.restoreAllMocks())

describe('registry — endpoint provider selection', () => {
  it('defaults to the incumbent openai, and falls back to it on an unknown id', () => {
    expect(selectProvider({}).id).toBe('openai')
    expect(selectProvider({ ONLINE_PROVIDER: 'nope' }).id).toBe('openai')
  })
  it('selects a named provider', () => {
    expect(selectProvider({ ONLINE_PROVIDER: 'tavily' }).id).toBe('tavily')
    expect(providerById('perplexity')?.id).toBe('perplexity')
  })
})

describe('available() is honest — a provider without its key never runs', () => {
  it('no keys ⇒ nothing available', () => {
    expect(availableProviders({})).toEqual([])
  })
  it('only keyed providers are available', () => {
    const av = availableProviders({ OPENAI_API_KEY: 'x', TAVILY_API_KEY: 'y' }).map((p) => p.id)
    expect(av).toContain('openai')
    expect(av).toContain('tavily')
    expect(av).not.toContain('brave')
  })
  it('every provider names the env var it needs', () => {
    for (const p of ALL_PROVIDERS) expect(p.keyEnv).toMatch(/API_KEY$/)
  })
})

describe('bake-off corpus', () => {
  it('has at least 30 questions with unique ids and both languages', () => {
    expect(BAKEOFF_CORPUS.length).toBeGreaterThanOrEqual(30)
    expect(new Set(BAKEOFF_CORPUS.map((c) => c.id)).size).toBe(BAKEOFF_CORPUS.length)
    expect(BAKEOFF_CORPUS.some((c) => c.lang === 'he')).toBe(true)
    expect(BAKEOFF_CORPUS.some((c) => c.lang === 'es')).toBe(true)
    for (const c of BAKEOFF_CORPUS) expect(c.q.trim().length).toBeGreaterThan(0)
  })
  it('covers the required categories', () => {
    const cats = new Set(BAKEOFF_CORPUS.map((c) => c.category))
    for (const need of ['news', 'sports', 'weather', 'cinema', 'prices', 'hours']) expect(cats.has(need)).toBe(true)
  })
})

describe('adapters — no key ⇒ honest NO_KEY, no network', () => {
  it('each adapter refuses without its key and never calls fetch', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    for (const p of [openaiProvider, tavilyProvider, braveProvider, perplexityProvider]) {
      const r = await p.search('q', 'he', {})
      expect(r.ok).toBe(false)
      expect(r.error).toBe('NO_KEY')
    }
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('adapters — map each provider response → ProviderResult', () => {
  it('openai: extracts the answer + url_citation sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      output: [{ content: [{ type: 'output_text', text: 'תשובה', annotations: [{ type: 'url_citation', url: 'https://a.example', title: 'A' }] }] }],
    }), { status: 200 })))
    const r = await openaiProvider.search('q', 'he', { OPENAI_API_KEY: 'k' })
    expect(r.ok).toBe(true)
    expect(r.answer).toBe('תשובה')
    expect(r.sources).toHaveLength(1)
  })
  it('tavily: answer + results → sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ answer: 'ans', results: [{ title: 'T', url: 'https://t.example' }] }), { status: 200 })))
    const r = await tavilyProvider.search('q', 'he', { TAVILY_API_KEY: 'k' })
    expect(r.ok).toBe(true)
    expect(r.answer).toBe('ans')
    expect(r.sources[0]!.url).toBe('https://t.example')
  })
  it('brave: web.results → sources (top snippet as context)', async () => {
    const fetchSpy = vi.fn(async (..._a: unknown[]) => new Response(JSON.stringify({ web: { results: [{ title: 'B', url: 'https://b.example', description: 'snippet' }] } }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const r = await braveProvider.search('q', 'he', { BRAVE_API_KEY: 'k' })
    expect(r.ok).toBe(true)
    expect(r.sources[0]!.url).toBe('https://b.example')
    expect(r.answer).toBe('snippet')
    // Regression (verified against the live key): Brave's country enum has NO Israel,
    // so `country=IL` returns 422. The request must NOT pin an unsupported country and
    // must keep Hebrew search_lang.
    const calledUrl = String(fetchSpy.mock.calls[0]![0])
    expect(calledUrl).not.toContain('country=')
    expect(calledUrl).toContain('search_lang=he')
  })
  it('perplexity: content + citations → answer + sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'sonar' } }], citations: ['https://p.example'] }), { status: 200 })))
    const r = await perplexityProvider.search('q', 'he', { PERPLEXITY_API_KEY: 'k' })
    expect(r.ok).toBe(true)
    expect(r.answer).toBe('sonar')
    expect(r.sources[0]!.url).toBe('https://p.example')
  })
  it('a thrown call → PROVIDER_FAILED; an abort → TIMEOUT', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net') }))
    expect((await tavilyProvider.search('q', 'he', { TAVILY_API_KEY: 'k' })).error).toBe('PROVIDER_FAILED')
    vi.stubGlobal('fetch', vi.fn(async () => { const e = new Error('a'); e.name = 'AbortError'; throw e }))
    expect((await tavilyProvider.search('q', 'he', { TAVILY_API_KEY: 'k' })).error).toBe('TIMEOUT')
  })
})
