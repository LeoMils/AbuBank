/*
 * onlineEndpointHardening.test.ts — /api/abuai-online, every FAILURE branch (CODE / MOCK).
 * ════════════════════════════════════════════════════════════════════════════
 * Complements onlineGroundingGate.test.ts (which proves grounded→ok and zero-sources→
 * honest failure) by locking the endpoint's other guards. The through-line is the
 * Part-2 invariant "NO VERIFIED RESULT ⇒ NO CLAIM": on EVERY failure the endpoint
 * returns ok:false, NO `answer` field (nothing to read aloud), and an honest
 * userMessage — it never invents, and personal/family/calendar queries never even
 * reach the provider.
 *
 * Evidence class: CODE / AUTOMATED_TEST (endpoint handler run with a mocked provider
 * and a mocked env). Real retrieval against OpenAI is PROVIDER/PREVIEW — not claimed.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import handler from '../../api/abuai-online'

const URL = 'http://localhost/api/abuai-online'
const post = (body: unknown): Request =>
  new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

interface OnlineFail { ok: boolean; errorCode?: string; userMessage?: string; answer?: unknown }

/** Every failure MUST be ok:false, carry NO answer to read aloud, and give an honest line. */
function expectHonestFailure(j: OnlineFail, code: string): void {
  expect(j.ok).toBe(false)
  expect(j.errorCode).toBe(code)
  expect(j.answer).toBeUndefined()               // nothing invented is ever surfaced
  expect(typeof j.userMessage).toBe('string')
  expect((j.userMessage ?? '').length).toBeGreaterThan(0)
}

describe('/api/abuai-online — honest failure on every branch (no verified result ⇒ no claim)', () => {
  beforeEach(() => { (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: { OPENAI_API_KEY: 'test-key' } } })
  afterEach(() => { vi.restoreAllMocks() })

  // ── request validation ──────────────────────────────────────────────────────
  it('a non-POST request is rejected (405, BAD_REQUEST) — never reaches the provider', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const res = await handler(new Request(URL, { method: 'GET' }))
    expect(res.status).toBe(405)
    expectHonestFailure(await res.json() as OnlineFail, 'BAD_REQUEST')
    expect(spy).not.toHaveBeenCalled()
  })

  it('malformed JSON body → BAD_REQUEST 400', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const res = await handler(new Request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' }))
    expect(res.status).toBe(400)
    expectHonestFailure(await res.json() as OnlineFail, 'BAD_REQUEST')
    expect(spy).not.toHaveBeenCalled()
  })

  it('empty / too-short / too-long query → BAD_REQUEST 400', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    for (const query of ['', 'a', 'x'.repeat(601)]) {
      const res = await handler(post({ query }))
      expect(res.status).toBe(400)
      expectHonestFailure(await res.json() as OnlineFail, 'BAD_REQUEST')
    }
    expect(spy).not.toHaveBeenCalled()
  })

  // ── the "not for family/calendar" guard (server-side, before any provider call) ──
  it('a PERSONAL (family/calendar) query is blocked and NEVER hits the provider', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const res = await handler(post({ query: 'מה יש לי מחר ביומן', lang: 'he' }))
    expectHonestFailure(await res.json() as OnlineFail, 'ONLINE_QUERY_BLOCKED_PERSONAL')
    expect(spy).not.toHaveBeenCalled()   // personal info is answered locally, not online
  })

  it('a family-name query is also blocked server-side (defence in depth)', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const res = await handler(post({ query: 'ספרי לי על לאו', lang: 'he' }))
    expectHonestFailure(await res.json() as OnlineFail, 'ONLINE_QUERY_BLOCKED_PERSONAL')
    expect(spy).not.toHaveBeenCalled()
  })

  // ── provider / config failures — all honest, none invented ───────────────────
  it('no API key configured → OPENAI_API_KEY_MISSING, no provider call', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} }
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const res = await handler(post({ query: 'weather in Tel Aviv now', lang: 'he' }))
    expectHonestFailure(await res.json() as OnlineFail, 'OPENAI_API_KEY_MISSING')
    expect(spy).not.toHaveBeenCalled()
  })

  it('a provider timeout (AbortError) → ONLINE_TIMEOUT', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e }))
    const res = await handler(post({ query: 'latest news now', lang: 'he' }))
    expectHonestFailure(await res.json() as OnlineFail, 'ONLINE_TIMEOUT')
  })

  it('a provider network error → ONLINE_PROVIDER_FAILED', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    const res = await handler(post({ query: 'latest news now', lang: 'he' }))
    expectHonestFailure(await res.json() as OnlineFail, 'ONLINE_PROVIDER_FAILED')
  })

  it('a non-OK provider response → ONLINE_PROVIDER_FAILED', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream error', { status: 500 })))
    const res = await handler(post({ query: 'latest news now', lang: 'he' }))
    expectHonestFailure(await res.json() as OnlineFail, 'ONLINE_PROVIDER_FAILED')
  })

  it('a provider response with NO answer text → ONLINE_PROVIDER_FAILED (never fabricates one)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ output: [] }), { status: 200 })))
    const res = await handler(post({ query: 'latest news now', lang: 'he' }))
    expectHonestFailure(await res.json() as OnlineFail, 'ONLINE_PROVIDER_FAILED')
  })

  // ── the honest line follows the query language ───────────────────────────────
  it('the honest failure message is localized (Spanish / English)', async () => {
    (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env: {} }
    vi.stubGlobal('fetch', vi.fn())
    const es = await (await handler(post({ query: '¿qué tiempo hace hoy?', lang: 'es' }))).json() as OnlineFail
    expect(es.errorCode).toBe('OPENAI_API_KEY_MISSING')
    expect(es.userMessage).toMatch(/no puedo|conexión/i)
    const en = await (await handler(post({ query: 'weather today', lang: 'en' }))).json() as OnlineFail
    expect(en.userMessage).toMatch(/cannot check|not configured/i)
  })
})
