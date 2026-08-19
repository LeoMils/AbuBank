/*
 * Trust gate: a provider/proxy error must NEVER reach Martita as raw JSON, a raw
 * OpenAI/Vercel error object, or a stack. sendServerChat must always return a
 * safe, localized userMessage. This is the deterministic stand-in for the e2e
 * "provider error → safe user message" mapping.
 */
import { describe, it, expect } from 'vitest'
import { sendServerChat } from './serverChatProvider'

function fetchReturning(payload: unknown, ok = true): typeof fetch {
  return (async () => ({
    ok,
    headers: { get: () => 'application/json' },
    json: async () => payload,
  })) as unknown as typeof fetch
}

const RAW_LEAK = /[{}]|"error"|stack|openai|vercel|undefined|Bearer|sk-/i

describe('provider error → safe user message (no raw output)', () => {
  it('maps a raw OpenAI error object to a safe Hebrew message', async () => {
    const r = await sendServerChat({ model: 'x', messages: [] }, {
      lang: 'he',
      fetchImpl: fetchReturning({ error: { message: 'Rate limit', type: 'rate_limit_error' } }),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.userMessage.length).toBeGreaterThan(0)
      expect(r.userMessage).not.toMatch(RAW_LEAK)
    }
  })

  it('maps malformed/garbage upstream to a safe message', async () => {
    const r = await sendServerChat({ model: 'x', messages: [] }, {
      lang: 'he',
      fetchImpl: fetchReturning('not a json object'),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.userMessage).not.toMatch(RAW_LEAK)
  })

  it('passes through a structured proxy error with its safe copy', async () => {
    const r = await sendServerChat({ model: 'x', messages: [] }, {
      lang: 'he',
      fetchImpl: fetchReturning({ ok: false, errorCode: 'CHAT_TIMEOUT', userMessage: 'התשובה לקחה יותר מדי זמן. תנסי עוד רגע.' }),
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('CHAT_TIMEOUT')
      expect(r.userMessage).not.toMatch(RAW_LEAK)
    }
  })

  it('returns localized safe copy for Spanish and English', async () => {
    const es = await sendServerChat({ model: 'x', messages: [] }, { lang: 'es', fetchImpl: fetchReturning({ error: 'boom' }) })
    const en = await sendServerChat({ model: 'x', messages: [] }, { lang: 'en', fetchImpl: fetchReturning({ error: 'boom' }) })
    expect(es.ok).toBe(false)
    expect(en.ok).toBe(false)
    if (!es.ok) expect(es.userMessage).not.toMatch(RAW_LEAK)
    if (!en.ok) expect(en.userMessage).not.toMatch(RAW_LEAK)
    // Spanish copy must not be the Hebrew copy (localization actually applied).
    if (!es.ok && !en.ok) expect(es.userMessage).not.toBe(en.userMessage)
  })

  it('network rejection maps to a safe message, never throws to the caller', async () => {
    const throwingFetch = (async () => { throw new Error('ECONNREFUSED 127.0.0.1') }) as unknown as typeof fetch
    const r = await sendServerChat({ model: 'x', messages: [] }, { lang: 'he', fetchImpl: throwingFetch })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.userMessage).not.toMatch(RAW_LEAK)
  })
})
