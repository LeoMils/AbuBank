/*
 * AbuAI server chat proxy (B2.1)
 *
 * Pass-through endpoint that forwards the OpenAI Chat Completions request
 * server-side so the OPENAI_API_KEY never reaches the browser bundle.
 * Supports both non-streaming JSON responses (used by `sendMessage` for
 * tool-calling personal queries) and SSE streaming (used by
 * `streamMessage` for the open conversation path).
 *
 * Hard rules:
 *   • The OpenAI API key is read only from server env.
 *   • If the key is missing, the endpoint returns a structured
 *     OPENAI_API_KEY_MISSING error in JSON — never a streamed response.
 *   • The endpoint is a thin proxy — prompt building and tool-loop logic
 *     stay in the existing client code (`service.ts`). This keeps the
 *     migration small and lets us flip to server-side in one PR.
 */

export const config = { runtime: 'edge' }

interface ChatProxyPayload {
  /** OpenAI chat-completions request body. Forwarded verbatim. */
  body: Record<string, unknown>
  /** When true, server pipes back SSE chunks unchanged. */
  stream?: boolean
  /** Hint for the user-facing error language. */
  lang?: 'he' | 'es' | 'en' | 'mixed'
}

type ChatProxyErrorCode =
  | 'OPENAI_API_KEY_MISSING'
  | 'CHAT_PROVIDER_FAILED'
  | 'CHAT_TIMEOUT'
  | 'BAD_REQUEST'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const REQUEST_TIMEOUT_MS = 25_000

function userMessageFor(code: ChatProxyErrorCode, lang: ChatProxyPayload['lang'] = 'he'): string {
  const ES: Record<ChatProxyErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'No puedo responder ahora porque la conexión de AI no está configurada en el servidor.',
    CHAT_PROVIDER_FAILED: 'No puedo responder ahora. Probá de nuevo en un momento.',
    CHAT_TIMEOUT: 'La respuesta tardó demasiado. Probá de nuevo.',
    BAD_REQUEST: 'No entendí la consulta.',
  }
  const HE: Record<ChatProxyErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'יש בעיה בשירות. דברי עם לאו והוא יסדר את זה.',
    CHAT_PROVIDER_FAILED: 'רגע, זה לא עבר לי. ננסה שוב?',
    CHAT_TIMEOUT: 'התשובה לקחה יותר מדי זמן. ננסה שוב?',
    BAD_REQUEST: 'לא הבנתי. תנסי לשאול אחרת?',
  }
  const EN: Record<ChatProxyErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'I cannot answer right now because the server AI connection is not configured.',
    CHAT_PROVIDER_FAILED: 'I cannot answer right now. Please try again in a moment.',
    CHAT_TIMEOUT: 'The response took too long. Please try again.',
    BAD_REQUEST: 'I did not understand the question.',
  }
  if (lang === 'es') return ES[code]
  if (lang === 'en') return EN[code]
  return HE[code]
}

function jsonError(code: ChatProxyErrorCode, lang: ChatProxyPayload['lang'], status = 200): Response {
  return new Response(JSON.stringify({
    ok: false,
    errorCode: code,
    userMessage: userMessageFor(code, lang),
  }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

import { rateLimited, circuitTripped, clientKey } from './_rateLimit'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return jsonError('BAD_REQUEST', 'he', 405)
  }
  // A7/B rate + cost protection. Envelope: a chat turn is ~1-2 calls; conversation ~a few turns/min →
  // 40/min/IP generous, abusive above. Circuit: 800 chat calls/min/instance.
  if (rateLimited(`chat:${clientKey(req)}`, 40, 60_000) || circuitTripped('chat', 800, 60_000)) return jsonError('CHAT_PROVIDER_FAILED', 'he', 429)

  let payload: ChatProxyPayload
  try {
    payload = (await req.json()) as ChatProxyPayload
  } catch {
    return jsonError('BAD_REQUEST', 'he', 400)
  }
  const lang = payload.lang ?? 'he'
  if (!payload.body || typeof payload.body !== 'object') {
    return jsonError('BAD_REQUEST', lang, 400)
  }
  // A7 cost-amplification caps (no user auth on this PWA → bounded per-request limits are the
  // machine-closable mitigation; a rate-limit/auth policy remains an owner decision). Reject an
  // abuse-sized payload and clamp the completion length before the billable OpenAI call.
  const bodyBytes = JSON.stringify(payload.body).length
  if (bodyBytes > 200_000) return jsonError('BAD_REQUEST', lang, 413)
  const msgs = (payload.body as { messages?: unknown }).messages
  if (Array.isArray(msgs) && msgs.length > 60) return jsonError('BAD_REQUEST', lang, 413)
  const mt = (payload.body as { max_tokens?: unknown }).max_tokens
  if (typeof mt === 'number' && mt > 4096) (payload.body as { max_tokens?: number }).max_tokens = 4096

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) {
    // Always JSON when the key is missing — even if the client asked for
    // streaming. The client knows to handle the JSON error.
    return jsonError('OPENAI_API_KEY_MISSING', lang)
  }

  const stream = payload.stream === true
  // Mirror the requested stream flag in the upstream body so OpenAI knows
  // whether to send SSE.
  const upstreamBody = { ...payload.body, stream }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let upstream: Response
  try {
    upstream = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    const code: ChatProxyErrorCode = (err as { name?: string } | null)?.name === 'AbortError' ? 'CHAT_TIMEOUT' : 'CHAT_PROVIDER_FAILED'
    return jsonError(code, lang)
  }
  clearTimeout(timeout)

  if (!upstream.ok || !upstream.body) {
    return jsonError('CHAT_PROVIDER_FAILED', lang)
  }

  if (stream) {
    // Pass the SSE stream back unchanged. Upstream sets text/event-stream;
    // we propagate that and disable buffering on the platform.
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store',
        // Vercel-specific hint to disable response buffering.
        'X-Accel-Buffering': 'no',
      },
    })
  }

  // Non-streaming: forward the JSON body. Wrap inside { ok: true, openai: ... }
  // so client can distinguish from the OPENAI_API_KEY_MISSING error shape.
  let json: unknown
  try { json = await upstream.json() } catch {
    return jsonError('CHAT_PROVIDER_FAILED', lang)
  }
  return new Response(JSON.stringify({ ok: true, openai: json }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
