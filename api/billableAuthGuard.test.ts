/*
 * billableAuthGuard.test.ts — the security invariant on every billable endpoint.
 * (CODE evidence; the deployed Preview adds PREVIEW-class negative tests.)
 *
 * Proves, for chat/tts/stt/online/news/realtime-token:
 *   • an UNAUTHENTICATED POST → 401 AND ZERO provider call (fetch never invoked),
 *   • a request with a valid server session gets PAST the auth guard (not 401),
 *   • a forged session cookie → 401.
 * realtime-token gets special attention: it must never MINT a billable session
 * for an unauthenticated caller.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { signToken, COOKIE, TTL } from './_session'
import { _resetRateLimit } from './_rateLimit'
import chat from './abuai-chat'
import tts from './abuai-tts'
import stt from './abuai-stt'
import online from './abuai-online'
import news from './abuai-news'
import realtime from './realtime-token'

const SECRET = 'test-signing-secret-abu-ela-000000'

const ENDPOINTS: Record<string, (req: Request) => Promise<Response>> = {
  'abuai-chat': chat,
  'abuai-tts': tts,
  'abuai-stt': stt,
  'abuai-online': online,
  'abuai-news': news,
  'realtime-token': realtime,
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  process.env.AUTH_SIGNING_SECRET = SECRET
  process.env.ENROLLMENT_SECRET = 'owner-enroll-code-123'
  process.env.OPENAI_API_KEY = 'sk-test-dummy-key-not-real-000000000000'
  _resetRateLimit()
  // Any provider call would go through global fetch — spy so we can prove it never fires
  // on an unauthenticated request, and so an authed test never hits the real network.
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
})
afterEach(() => {
  fetchSpy.mockRestore()
})

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://abu-ela.example/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('UNAUTHENTICATED → 401 and ZERO provider call', () => {
  for (const [name, handler] of Object.entries(ENDPOINTS)) {
    it(`${name}: unauthenticated POST is 401 with no provider fetch`, async () => {
      const res = await handler(post({ body: { input: 'x', messages: [] }, query: 'x' }))
      expect(res.status).toBe(401)
      // The ONLY fetch a handler makes is the provider call — it must not have fired.
      const providerCalls = fetchSpy.mock.calls.filter((call: unknown[]) => String(call[0]).includes('http'))
      expect(providerCalls.length).toBe(0)
    })
  }

  it('realtime-token mints NO token for an unauthenticated caller', async () => {
    const res = await realtime(post({}))
    expect(res.status).toBe(401)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('FORGED session → 401', () => {
  for (const [name, handler] of Object.entries(ENDPOINTS)) {
    it(`${name}: a bogus session cookie is rejected`, async () => {
      const res = await handler(post({ body: { input: 'x' } }, { cookie: `${COOKIE.session}=forged.token.here` }))
      expect(res.status).toBe(401)
    })
  }
})

describe('AUTHORIZED session → gets past the auth guard (not 401)', () => {
  for (const [name, handler] of Object.entries(ENDPOINTS)) {
    it(`${name}: a valid session is NOT blocked with 401`, async () => {
      const tok = (await signToken('session', { deviceId: 'd1' }, TTL.sessionMs))!
      const res = await handler(post({ body: { input: 'hi', messages: [{ role: 'user', content: 'hi' }] }, query: 'hi' }, { cookie: `${COOKIE.session}=${tok}` }))
      expect(res.status).not.toBe(401)
    })
  }
})
