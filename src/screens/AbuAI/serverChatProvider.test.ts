/*
 * AbuAI B2.1 — serverChatProvider tests
 *
 * Pins the contract:
 *   • Non-streaming success forwards { ok: true, openai }
 *   • Missing-key failure surfaces OPENAI_API_KEY_MISSING with HE/ES/EN copy
 *   • Streaming success yields token deltas
 *   • Streaming failure (JSON missing-key body) yields nothing and records
 *     the error code (so the caller can fall through to Gemini/Groq)
 *   • checkServerChatHealth() returns no secret-shaped fields
 */

import { describe, it, expect } from 'vitest'
import {
  sendServerChat,
  streamServerChat,
  checkServerChatHealth,
  _recordServerChatError,
} from './serverChatProvider'

function fakeJsonOk(payload: object): typeof fetch {
  return (async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as unknown as typeof fetch
}
function fakeJsonError(errorCode: string, userMessage: string): typeof fetch {
  return (async () => new Response(JSON.stringify({ ok: false, errorCode, userMessage }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as unknown as typeof fetch
}
function fakeSseStream(chunks: string[]): typeof fetch {
  return (async () => {
    const enc = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(enc.encode(chunk))
        controller.close()
      },
    })
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    })
  }) as unknown as typeof fetch
}

describe('sendServerChat — non-streaming', () => {
  it('forwards { ok: true, openai } payload on success', async () => {
    const fetchImpl = fakeJsonOk({ ok: true, openai: { choices: [{ message: { content: 'hola' } }] } })
    const r = await sendServerChat({ model: 'gpt-4o', messages: [] }, { fetchImpl })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const openai = r.openai as { choices?: Array<{ message?: { content?: string } }> }
      expect(openai.choices?.[0]?.message?.content).toBe('hola')
    }
  })

  it('maps OPENAI_API_KEY_MISSING with Spanish copy', async () => {
    const fetchImpl = fakeJsonError('OPENAI_API_KEY_MISSING', 'No puedo responder ahora porque la conexión de AI no está configurada en el servidor.')
    const r = await sendServerChat({ model: 'gpt-4o', messages: [] }, { fetchImpl, lang: 'es' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errorCode).toBe('OPENAI_API_KEY_MISSING')
      expect(r.userMessage).toContain('No puedo responder')
    }
  })

  it('maps generic CHAT_PROVIDER_FAILED', async () => {
    const fetchImpl = fakeJsonError('CHAT_PROVIDER_FAILED', 'No puedo responder ahora.')
    const r = await sendServerChat({ model: 'gpt-4o', messages: [] }, { fetchImpl })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('CHAT_PROVIDER_FAILED')
  })

  it('returns CLIENT_NETWORK_ERROR when fetch throws non-abort', async () => {
    const fetchImpl: typeof fetch = (async () => { throw new Error('network down') }) as unknown as typeof fetch
    const r = await sendServerChat({ model: 'gpt-4o', messages: [] }, { fetchImpl })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errorCode).toBe('CLIENT_NETWORK_ERROR')
  })
})

describe('streamServerChat — streaming', () => {
  it('yields token deltas from SSE stream', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"Mirá, "}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"podemos"}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    const fetchImpl = fakeSseStream(sse)
    const tokens: string[] = []
    for await (const t of streamServerChat({ model: 'gpt-4o', messages: [] }, { fetchImpl })) {
      tokens.push(t)
    }
    expect(tokens.length).toBe(2)
    expect(tokens.join('')).toBe('Mirá, podemos')
  })

  it('yields nothing AND records error code on JSON missing-key body', async () => {
    _recordServerChatError(null) // reset
    const fetchImpl = fakeJsonError('OPENAI_API_KEY_MISSING', 'server key missing')
    const tokens: string[] = []
    for await (const t of streamServerChat({ model: 'gpt-4o', messages: [] }, { fetchImpl })) {
      tokens.push(t)
    }
    expect(tokens.length).toBe(0)
    const h = checkServerChatHealth()
    expect(h.lastErrorCode).toBe('OPENAI_API_KEY_MISSING')
    _recordServerChatError(null)
  })

  it('yields nothing on network throw', async () => {
    _recordServerChatError(null)
    const fetchImpl: typeof fetch = (async () => { throw new Error('boom') }) as unknown as typeof fetch
    const tokens: string[] = []
    for await (const t of streamServerChat({ model: 'gpt-4o', messages: [] }, { fetchImpl })) {
      tokens.push(t)
    }
    expect(tokens.length).toBe(0)
    expect(checkServerChatHealth().lastErrorCode).toBe('CLIENT_NETWORK_ERROR')
    _recordServerChatError(null)
  })
})

describe('checkServerChatHealth', () => {
  it('returns server-mode shape with endpoint configured', () => {
    const h = checkServerChatHealth()
    expect(h.provider).toBe('openai-server-proxy')
    expect(h.mode).toBe('server')
    expect(h.endpointConfigured).toBe(true)
  })

  it('does not include any secret-shaped field', () => {
    const h = checkServerChatHealth() as unknown as Record<string, unknown>
    for (const key of Object.keys(h)) {
      expect(/key|secret|token|bearer|password/i.test(key)).toBe(false)
    }
  })

  it('reflects the last error code', () => {
    _recordServerChatError('CHAT_PROVIDER_FAILED')
    expect(checkServerChatHealth().lastErrorCode).toBe('CHAT_PROVIDER_FAILED')
    _recordServerChatError(null)
    expect(checkServerChatHealth().lastErrorCode).toBeNull()
  })
})
