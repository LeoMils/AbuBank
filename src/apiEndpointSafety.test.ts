/*
 * Provider/STT/Realtime non-device safety for the server proxies that hold the
 * billable OpenAI key. Verifies: missing/placeholder key → safe JSON (no upstream
 * call), invalid/quota upstream → classified safe error (never raw), realtime
 * returns ONLY the short-lived ephemeral secret (never the long-lived key), and no
 * response ever leaks the key or a raw provider body.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import ttsHandler from '../api/abuai-tts'
import realtimeHandler from '../api/realtime-token'

const REAL = 'sk-proj-' + 'A1b2C3d4'.repeat(6) // 56 chars, not a placeholder
const PLACEHOLDER = 'sk-...'
const RAW_LEAK = /sk-proj-|Bearer\s|"error"\s*:\s*\{|stack|rate_limit_error/i

function envKey(v: string | undefined) {
  if (v === undefined) delete (globalThis as { process: { env: Record<string, string | undefined> } }).process.env.OPENAI_API_KEY
  else (globalThis as { process: { env: Record<string, string | undefined> } }).process.env.OPENAI_API_KEY = v
}
function post(body: unknown): Request {
  return new Request('https://x/api', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => { vi.unstubAllGlobals(); envKey(undefined) })

describe('api/abuai-tts — safe TTS proxy', () => {
  it('missing/placeholder key → OPENAI_API_KEY_MISSING, never calls upstream', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    envKey(PLACEHOLDER)
    const res = await ttsHandler(post({ body: { model: 'gpt-4o-mini-tts', input: 'hola' } }))
    const j = await res.json() as { ok: boolean; error: string }
    expect(j.ok).toBe(false); expect(j.error).toBe('OPENAI_API_KEY_MISSING')
    expect(spy).not.toHaveBeenCalled()
  })
  it('upstream 401 → OPENAI_API_KEY_INVALID (no raw leak)', async () => {
    envKey(REAL)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"message":"bad key"}}', { status: 401 })))
    const res = await ttsHandler(post({ body: { model: 'gpt-4o-mini-tts', input: 'hola' } }))
    const txt = await res.text()
    expect(txt).toContain('OPENAI_API_KEY_INVALID')
    expect(RAW_LEAK.test(txt)).toBe(false)
  })
  it('upstream 429 → TTS_QUOTA', async () => {
    envKey(REAL)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate', { status: 429 })))
    const res = await ttsHandler(post({ body: { model: 'gpt-4o-mini-tts', input: 'hola' } }))
    expect((await res.json() as { error: string }).error).toBe('TTS_QUOTA')
  })
  it('success → audio bytes passed through', async () => {
    envKey(REAL)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })))
    const res = await ttsHandler(post({ body: { model: 'gpt-4o-mini-tts', input: 'hola' } }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('audio')
  })
  it('bad request (no input) → BAD_REQUEST', async () => {
    envKey(REAL)
    const res = await ttsHandler(post({ body: { model: 'x' } }))
    expect((await res.json() as { error: string }).error).toBe('BAD_REQUEST')
  })
})

describe('api/realtime-token — ephemeral only, key never leaks', () => {
  it('placeholder key → OPENAI_API_KEY_MISSING, no upstream', async () => {
    const spy = vi.fn(); vi.stubGlobal('fetch', spy)
    envKey(PLACEHOLDER)
    const res = await realtimeHandler(post({ instructions: 'hi' }))
    expect((await res.json() as { error: string }).error).toBe('OPENAI_API_KEY_MISSING')
    expect(spy).not.toHaveBeenCalled()
  })
  it('success → returns ONLY the ephemeral client_secret, never the long-lived key', async () => {
    envKey(REAL)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ client_secret: { value: 'ek_ephemeral_123' } }), { status: 200 })))
    const res = await realtimeHandler(post({ instructions: 'hi' }))
    const txt = await res.text()
    const j = JSON.parse(txt) as { ok: boolean; client_secret: string }
    expect(j.ok).toBe(true)
    expect(j.client_secret).toBe('ek_ephemeral_123')
    expect(txt.includes(REAL)).toBe(false) // long-lived key never returned
    expect(RAW_LEAK.test(txt)).toBe(false)
  })
  it('upstream 401 → OPENAI_API_KEY_INVALID; 429 → REALTIME_QUOTA', async () => {
    envKey(REAL)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 401 })))
    expect((await (await realtimeHandler(post({}))).json() as { error: string }).error).toBe('OPENAI_API_KEY_INVALID')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 429 })))
    expect((await (await realtimeHandler(post({}))).json() as { error: string }).error).toBe('REALTIME_QUOTA')
  })
})
