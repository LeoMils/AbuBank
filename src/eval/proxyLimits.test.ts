/*
 * proxyLimits.test.ts — A7 cost-amplification caps on the billable server proxies (CODE/MOCK).
 * Each proxy rejects an abuse-sized request BEFORE the billable provider call (no user auth on this
 * PWA → bounded per-request limits are the machine-closable mitigation; auth/rate-limit = owner decision).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import ttsHandler from '../../api/abuai-tts'
import chatHandler from '../../api/abuai-chat'
import sttHandler from '../../api/abuai-stt'
import { _resetRateLimit } from '../../api/_rateLimit'

const setEnv = (env: Record<string, string>) => { (globalThis as unknown as { process: { env: Record<string, string> } }).process = { env } }
const KEY = 'sk-test-0123456789abcdefghij'
beforeEach(() => _resetRateLimit())
afterEach(() => vi.restoreAllMocks())

const postJson = (url: string, body: unknown) => new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

describe('A7 · TTS input cap', () => {
  it('rejects an oversized input (>2000 chars) before the OpenAI call', async () => {
    setEnv({ OPENAI_API_KEY: KEY })
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const res = await ttsHandler(postJson('http://x/api/abuai-tts', { body: { input: 'א'.repeat(2001), model: 'gpt-4o-mini-tts' } }))
    expect(res.status).toBe(400)
    expect(spy).not.toHaveBeenCalled()
  })
  it('allows a normal reply-sized input (fetches the provider)', async () => {
    setEnv({ OPENAI_API_KEY: KEY })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })))
    const res = await ttsHandler(postJson('http://x/api/abuai-tts', { body: { input: 'שלום, זאת תשובה רגילה.', model: 'gpt-4o-mini-tts' } }))
    expect(res.status).toBe(200)
  })
})

describe('A7 · chat caps', () => {
  it('rejects too many messages (>60) before the OpenAI call', async () => {
    setEnv({ OPENAI_API_KEY: KEY })
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const messages = Array.from({ length: 61 }, () => ({ role: 'user', content: 'hi' }))
    const res = await chatHandler(postJson('http://x/api/abuai-chat', { body: { model: 'gpt-4o', messages }, lang: 'he' }))
    expect(res.status).toBe(413)
    expect(spy).not.toHaveBeenCalled()
  })
  it('rejects an oversized body (>200KB) before the OpenAI call', async () => {
    setEnv({ OPENAI_API_KEY: KEY })
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const res = await chatHandler(postJson('http://x/api/abuai-chat', { body: { model: 'gpt-4o', messages: [{ role: 'user', content: 'x'.repeat(200_001) }] }, lang: 'he' }))
    expect(res.status).toBe(413)
    expect(spy).not.toHaveBeenCalled()
  })
  it('clamps max_tokens to 4096 in the upstream request', async () => {
    setEnv({ OPENAI_API_KEY: KEY })
    let sentBody: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => { sentBody = JSON.parse(init.body); return new Response(JSON.stringify({ ok: true }), { status: 200 }) }))
    await chatHandler(postJson('http://x/api/abuai-chat', { body: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], max_tokens: 999999 }, lang: 'he' }))
    expect(sentBody.max_tokens).toBe(4096)
  })
})

describe('A7 · STT audio-size cap', () => {
  it('rejects an oversized audio file (>5MB) before the Whisper call', async () => {
    setEnv({ OPENAI_API_KEY: KEY })
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    const fd = new FormData()
    fd.append('file', new Blob([new Uint8Array(5_000_001)], { type: 'audio/mpeg' }), 'big.mp3')
    const res = await sttHandler(new Request('http://x/api/abuai-stt', { method: 'POST', body: fd }))
    expect(res.status).toBe(413)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('A7/B · per-IP rate limit + cost circuit breaker', () => {
  it('a single IP flooding TTS is rejected with 429 once over the burst limit', async () => {
    setEnv({ OPENAI_API_KEY: KEY })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })))
    const req = () => new Request('http://x/api/abuai-tts', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' }, body: JSON.stringify({ body: { input: 'שלום', model: 'gpt-4o-mini-tts' } }) })
    let sawOk = 0, saw429 = 0
    for (let i = 0; i < 35; i++) { const r = await ttsHandler(req()); if (r.status === 429) saw429++; else if (r.status === 200) sawOk++ }
    expect(sawOk).toBe(30)     // the legitimate burst envelope
    expect(saw429).toBe(5)     // flood beyond it is throttled
  })
})
