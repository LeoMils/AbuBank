/*
 * AbuAI B2 — onlineProvider tests
 *
 * Exercises the client by injecting a fake fetch:
 *   - structured success (answer + sources) maps to ok: true
 *   - structured failure (errorCode) maps to ok: false with the right code
 *   - personal queries are blocked client-side WITHOUT calling fetch
 *   - timeout triggers ONLINE_TIMEOUT
 *   - missing-key error from server flows through unchanged
 *   - sources field is preserved when present and dropped when empty
 */

import { describe, it, expect } from 'vitest'
import { answerOnlineCurrentInfo, checkOnlineProviderHealth, _recordOnlineError } from './onlineProvider'

function fakeFetchOk(answer: string, sources?: Array<{ title?: string; url?: string }>) {
  return async (_url: string | URL | Request, _init?: RequestInit): Promise<Response> => {
    void _url; void _init
    const body = JSON.stringify({ ok: true, answer, ...(sources ? { sources } : {}) })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
}
function fakeFetchErr(errorCode: string, userMessage: string, status = 200) {
  return async (): Promise<Response> => {
    return new Response(JSON.stringify({ ok: false, errorCode, userMessage }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
function fakeFetchAbort() {
  return async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    void _url
    return new Promise<Response>((_, reject) => {
      // Listen for the AbortController from the test signal
      const signal = init?.signal as AbortSignal | undefined
      if (signal) {
        if (signal.aborted) {
          const err = new Error('aborted'); ;(err as Error & { name: string }).name = 'AbortError'; reject(err); return
        }
        signal.addEventListener('abort', () => {
          const err = new Error('aborted'); ;(err as Error & { name: string }).name = 'AbortError'; reject(err)
        })
      }
    })
  }
}

describe('answerOnlineCurrentInfo — success path', () => {
  it('maps a structured ok=true response to OnlineSuccessResult', async () => {
    const fetchImpl = fakeFetchOk('Hoy hay una película nueva en cartelera.', [{ title: 'Cinemark', url: 'https://example.com/cine' }])
    const r = await answerOnlineCurrentInfo('¿Qué películas hay ahora?', { lang: 'es', fetchImpl })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.answer).toContain('cartelera')
      expect(r.sources?.length).toBe(1)
      expect(r.sources?.[0]?.url).toBe('https://example.com/cine')
      expect(r.userMessage.length).toBeGreaterThan(0)
    }
  })

  it('drops the sources field when the server returned an empty array', async () => {
    const fetchImpl = fakeFetchOk('weather looks fine', [])
    const r = await answerOnlineCurrentInfo('weather today', { lang: 'en', fetchImpl })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.sources).toBeUndefined()
  })
})

describe('answerOnlineCurrentInfo — error mapping', () => {
  it('maps OPENAI_API_KEY_MISSING from server', async () => {
    const fetchImpl = fakeFetchErr('OPENAI_API_KEY_MISSING', 'No puedo comprobar información online ahora porque la conexión de AI no está configurada.')
    const r = await answerOnlineCurrentInfo('¿Qué películas hay?', { lang: 'es', fetchImpl })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('OPENAI_API_KEY_MISSING')
      expect(r.userMessage).toContain('No puedo comprobar')
    }
  })

  it('maps ONLINE_PROVIDER_FAILED from server', async () => {
    const fetchImpl = fakeFetchErr('ONLINE_PROVIDER_FAILED', 'No puedo comprobar información online ahora.')
    const r = await answerOnlineCurrentInfo('weather today', { lang: 'en', fetchImpl })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('ONLINE_PROVIDER_FAILED')
  })

  it('returns CLIENT_NETWORK_ERROR when fetch throws non-abort', async () => {
    const fetchImpl: typeof fetch = async () => { throw new Error('network down') }
    const r = await answerOnlineCurrentInfo('weather today', { lang: 'en', fetchImpl })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('CLIENT_NETWORK_ERROR')
  })

  it('returns ONLINE_TIMEOUT when client timeout fires', async () => {
    const fetchImpl = fakeFetchAbort()
    const r = await answerOnlineCurrentInfo('weather today', { lang: 'en', fetchImpl, timeoutMs: 30 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('ONLINE_TIMEOUT')
  })
})

describe('answerOnlineCurrentInfo — client-side personal block', () => {
  it('blocks "¿Qué tengo hoy?" before any network call', async () => {
    let called = false
    const fetchImpl: typeof fetch = async () => { called = true; return new Response('{}') }
    const r = await answerOnlineCurrentInfo('¿Qué tengo hoy?', { lang: 'es', fetchImpl })
    expect(called).toBe(false) // never reached the network
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('ONLINE_QUERY_BLOCKED_PERSONAL')
  })

  it('blocks "Háblame de Leo" without a network call', async () => {
    let called = false
    const fetchImpl: typeof fetch = async () => { called = true; return new Response('{}') }
    const r = await answerOnlineCurrentInfo('Háblame de Leo', { lang: 'es', fetchImpl })
    expect(called).toBe(false)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('ONLINE_QUERY_BLOCKED_PERSONAL')
  })
})

describe('answerOnlineCurrentInfo — bad request guard', () => {
  it('rejects empty query as BAD_REQUEST', async () => {
    const r = await answerOnlineCurrentInfo('   ', { lang: 'en' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('BAD_REQUEST')
  })

  it('rejects oversize query as BAD_REQUEST', async () => {
    const big = 'a'.repeat(601)
    const r = await answerOnlineCurrentInfo(big, { lang: 'en' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('BAD_REQUEST')
  })
})

describe('checkOnlineProviderHealth', () => {
  it('returns shape with provider="openai", mode="server", endpointConfigured=true', () => {
    const h = checkOnlineProviderHealth()
    expect(h.provider).toBe('openai')
    expect(h.mode).toBe('server')
    expect(h.endpointConfigured).toBe(true)
  })

  it('reflects the last error code recorded by the runtime', () => {
    _recordOnlineError(null)
    expect(checkOnlineProviderHealth().lastErrorCode).toBeNull()
    _recordOnlineError('OPENAI_API_KEY_MISSING')
    expect(checkOnlineProviderHealth().lastErrorCode).toBe('OPENAI_API_KEY_MISSING')
    _recordOnlineError(null)
  })

  it('does not include any secret-shaped field', () => {
    const h = checkOnlineProviderHealth() as unknown as Record<string, unknown>
    for (const key of Object.keys(h)) {
      expect(/key|secret|token|bearer/i.test(key)).toBe(false)
    }
  })
})
