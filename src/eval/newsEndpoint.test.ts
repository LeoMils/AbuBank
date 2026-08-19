/*
 * newsEndpoint.test.ts — /api/abuai-news grounding + honest failure (CODE / MOCK).
 * ════════════════════════════════════════════════════════════════════════════
 * Proves the Part-3 honesty invariants on the endpoint handler with a mocked
 * provider + env: grounded (cited) complete stories are returned; an UNCITED
 * response is rejected (may be memory); incomplete stories are dropped; and every
 * failure is honest with NO stories — never a fabricated headline/source/number.
 * Real retrieval against OpenAI is PROVIDER/PREVIEW — not claimed here.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import handler from '../../api/abuai-news'

const URL = 'http://localhost/api/abuai-news'
const post = (body: unknown): Request =>
  new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const FULL = { headline: 'כותרת אמיתית', summary: 'תקציר פשוט בעברית.', source: 'הארץ', url: 'https://haaretz.example/a', published: 'לפני שעה' }

/** Build an OpenAI Responses payload: output_text carries the JSON; annotations carry
 *  url_citations (the grounding proof). `cited:false` = web_search returned nothing. */
function provider(stories: unknown[], opts: { cited?: boolean } = {}): Response {
  const annotations = opts.cited === false ? [] : [{ type: 'url_citation', url: 'https://haaretz.example/a', title: 'הארץ' }]
  const body = { output: [{ content: [{ type: 'output_text', text: JSON.stringify({ stories }), annotations }] }] }
  return new Response(JSON.stringify(body), { status: 200 })
}

interface Res { ok: boolean; errorCode?: string; stories?: unknown[]; userMessage?: string }

describe('/api/abuai-news — grounded, or an honest failure (never fabricated)', () => {
  beforeEach(() => { (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: { OPENAI_API_KEY: 'test-key' } } })
  afterEach(() => { vi.restoreAllMocks() })

  it('grounded + cited + complete → ok:true with the stories', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => provider([FULL])))
    const j = await (await handler(post({ lang: 'he' }))).json() as Res
    expect(j.ok).toBe(true)
    expect(j.stories).toHaveLength(1)
    expect((j.stories?.[0] as { source: string }).source).toBe('הארץ')
  })

  it('UNCITED response (web_search returned nothing) → NEWS_NO_RESULTS (grounding gate)', async () => {
    // Model "produced" stories but there were zero citations → it may be memory → reject.
    vi.stubGlobal('fetch', vi.fn(async () => provider([FULL], { cited: false })))
    const j = await (await handler(post({ lang: 'he' }))).json() as Res
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('NEWS_NO_RESULTS')
    expect(j.stories).toBeUndefined()
  })

  it('cited but every story is incomplete → NEWS_NO_RESULTS (no half-blank cards)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => provider([{ ...FULL, source: '' }, { ...FULL, url: 'not-a-link' }])))
    const j = await (await handler(post({ lang: 'he' }))).json() as Res
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('NEWS_NO_RESULTS')
  })

  it('cited, mixed → returns only the complete stories', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => provider([FULL, { ...FULL, published: '' }])))
    const j = await (await handler(post({ lang: 'he' }))).json() as Res
    expect(j.ok).toBe(true)
    expect(j.stories).toHaveLength(1)
  })

  it('no API key → OPENAI_API_KEY_MISSING, provider never called', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} }
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const j = await (await handler(post({ lang: 'he' }))).json() as Res
    expect(j.ok).toBe(false)
    expect(j.errorCode).toBe('OPENAI_API_KEY_MISSING')
    expect(spy).not.toHaveBeenCalled()
  })

  it('non-POST → 405; malformed JSON → 400', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    expect((await handler(new Request(URL, { method: 'GET' }))).status).toBe(405)
    expect((await handler(new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad' }))).status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })

  it('provider timeout → NEWS_TIMEOUT; provider error → NEWS_PROVIDER_FAILED; non-OK → NEWS_PROVIDER_FAILED', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { const e = new Error('x'); e.name = 'AbortError'; throw e }))
    expect(((await (await handler(post({ lang: 'he' }))).json()) as Res).errorCode).toBe('NEWS_TIMEOUT')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('neterr') }))
    expect(((await (await handler(post({ lang: 'he' }))).json()) as Res).errorCode).toBe('NEWS_PROVIDER_FAILED')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('err', { status: 500 })))
    expect(((await (await handler(post({ lang: 'he' }))).json()) as Res).errorCode).toBe('NEWS_PROVIDER_FAILED')
  })
})
