/*
 * AbuAI server chat provider (B2.1)
 *
 * Talks to /api/abuai-chat so the OpenAI key never lives in the client
 * bundle. Two helpers:
 *   • sendServerChat(body, opts)      — non-streaming, JSON response.
 *   • streamServerChat(body, opts)    — async generator yielding token
 *                                        deltas exactly like the previous
 *                                        OpenAI SSE direct call.
 *
 * Both helpers always return a typed shape — never throw to the caller.
 */

const ENDPOINT = '/api/abuai-chat'
const DEFAULT_TIMEOUT_MS = 25_000

export type ServerChatErrorCode =
  | 'OPENAI_API_KEY_MISSING'
  | 'CHAT_PROVIDER_FAILED'
  | 'CHAT_TIMEOUT'
  | 'BAD_REQUEST'
  | 'CLIENT_NETWORK_ERROR'

export type ServerChatLang = 'he' | 'es' | 'en' | 'mixed'

export interface ServerChatSuccess {
  ok: true
  openai: unknown
}
export interface ServerChatFailure {
  ok: false
  errorCode: ServerChatErrorCode
  userMessage: string
}
export type ServerChatResult = ServerChatSuccess | ServerChatFailure

export interface ServerChatOptions {
  lang?: ServerChatLang
  signal?: AbortSignal
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

function userMessageFor(code: ServerChatErrorCode, lang: ServerChatLang = 'he'): string {
  const ES: Record<ServerChatErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'No puedo responder ahora porque la conexión de AI no está configurada en el servidor.',
    CHAT_PROVIDER_FAILED: 'No puedo responder ahora. Probá de nuevo en un momento.',
    CHAT_TIMEOUT: 'La respuesta tardó demasiado. Probá de nuevo.',
    BAD_REQUEST: 'No entendí la consulta.',
    CLIENT_NETWORK_ERROR: 'No tengo conexión ahora. Probá cuando vuelva el internet.',
  }
  const HE: Record<ServerChatErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'יש בעיה בשירות. דברי עם לאו והוא יסדר את זה.',
    CHAT_PROVIDER_FAILED: 'רגע, זה לא עבר לי. ננסה שוב?',
    CHAT_TIMEOUT: 'התשובה לקחה יותר מדי זמן. תנסי עוד רגע.',
    BAD_REQUEST: 'לא הבנתי את השאלה.',
    CLIENT_NETWORK_ERROR: 'אין לי חיבור עכשיו. נסי כשהאינטרנט יחזור.',
  }
  const EN: Record<ServerChatErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'I cannot answer right now because the server AI connection is not configured.',
    CHAT_PROVIDER_FAILED: 'I cannot answer right now. Please try again in a moment.',
    CHAT_TIMEOUT: 'The response took too long. Please try again.',
    BAD_REQUEST: 'I did not understand the question.',
    CLIENT_NETWORK_ERROR: 'No connection right now. Please try again when the internet is back.',
  }
  if (lang === 'es') return ES[code]
  if (lang === 'en') return EN[code]
  return HE[code]
}

/**
 * Non-streaming chat call. Returns either the upstream OpenAI JSON
 * (wrapped as `{ ok: true, openai }`) or a typed failure with
 * user-facing copy.
 */
export async function sendServerChat(
  body: Record<string, unknown>,
  options: ServerChatOptions = {},
): Promise<ServerChatResult> {
  const lang: ServerChatLang = options.lang ?? 'he'
  const f = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) {
    return { ok: false, errorCode: 'CLIENT_NETWORK_ERROR', userMessage: userMessageFor('CLIENT_NETWORK_ERROR', lang) }
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const localCtl = new AbortController()
  const timer = setTimeout(() => localCtl.abort(), timeoutMs)
  const signal = options.signal
    ? AbortSignal.any?.([options.signal, localCtl.signal]) ?? localCtl.signal
    : localCtl.signal

  let resp: Response
  try {
    resp = await f(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, lang, stream: false }),
      signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const isAbort = (err as { name?: string } | null)?.name === 'AbortError'
    const code: ServerChatErrorCode = isAbort ? 'CHAT_TIMEOUT' : 'CLIENT_NETWORK_ERROR'
    return { ok: false, errorCode: code, userMessage: userMessageFor(code, lang) }
  }
  clearTimeout(timer)

  let data: unknown
  try { data = await resp.json() } catch {
    return { ok: false, errorCode: 'CHAT_PROVIDER_FAILED', userMessage: userMessageFor('CHAT_PROVIDER_FAILED', lang) }
  }
  if (data && typeof data === 'object' && (data as Record<string, unknown>).ok === true) {
    return { ok: true, openai: (data as { openai?: unknown }).openai }
  }
  if (data && typeof data === 'object' && (data as Record<string, unknown>).ok === false) {
    const body = data as { errorCode?: unknown; userMessage?: unknown }
    const code = (typeof body.errorCode === 'string' ? body.errorCode : 'CHAT_PROVIDER_FAILED') as ServerChatErrorCode
    return {
      ok: false,
      errorCode: code,
      userMessage: typeof body.userMessage === 'string' && body.userMessage.length > 0
        ? body.userMessage
        : userMessageFor(code, lang),
    }
  }
  return { ok: false, errorCode: 'CHAT_PROVIDER_FAILED', userMessage: userMessageFor('CHAT_PROVIDER_FAILED', lang) }
}

/**
 * Streaming chat call. Yields token deltas (the same shape as the
 * previous OpenAI SSE direct path).
 *
 * On failure (network / timeout / OPENAI_API_KEY_MISSING / etc.) the
 * generator records the error via `_recordServerChatError(code)` and
 * returns WITHOUT yielding. This lets the caller fall through to a
 * client-side fallback provider (Gemini / Groq) using the existing
 * "yieldedAny ? return : continue" pattern.
 */
export async function* streamServerChat(
  body: Record<string, unknown>,
  options: ServerChatOptions = {},
): AsyncGenerator<string, void, undefined> {
  const lang: ServerChatLang = options.lang ?? 'he'
  const f = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) {
    _recordServerChatError('CLIENT_NETWORK_ERROR')
    return
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const localCtl = new AbortController()
  const timer = setTimeout(() => localCtl.abort(), timeoutMs)
  const signal = options.signal
    ? AbortSignal.any?.([options.signal, localCtl.signal]) ?? localCtl.signal
    : localCtl.signal

  let resp: Response
  try {
    resp = await f(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, lang, stream: true }),
      signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const isAbort = (err as { name?: string } | null)?.name === 'AbortError'
    _recordServerChatError(isAbort ? 'CHAT_TIMEOUT' : 'CLIENT_NETWORK_ERROR')
    return
  }

  // Server returns JSON (not SSE) when the API key is missing or another
  // structured failure happens. Detect by content-type and surface the
  // error code via the health channel.
  const ctype = resp.headers.get('Content-Type') ?? ''
  if (!resp.ok || ctype.includes('application/json')) {
    clearTimeout(timer)
    try {
      const data = await resp.json() as { errorCode?: unknown } | null
      const code = (data && typeof data.errorCode === 'string') ? data.errorCode as ServerChatErrorCode : 'CHAT_PROVIDER_FAILED'
      _recordServerChatError(code)
    } catch {
      _recordServerChatError('CHAT_PROVIDER_FAILED')
    }
    return
  }

  const reader = resp.body?.getReader()
  if (!reader) {
    clearTimeout(timer)
    yield userMessageFor('CHAT_PROVIDER_FAILED', lang)
    return
  }
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
          const token = parsed.choices?.[0]?.delta?.content
          if (token) yield token
        } catch {
          // malformed SSE chunk — skip
        }
      }
    }
  } finally {
    clearTimeout(timer)
  }
}

// ─── Health snapshot ───────────────────────────────────────────────────────

let _lastChatErrorCode: ServerChatErrorCode | null = null

export function _recordServerChatError(code: ServerChatErrorCode | null): void {
  _lastChatErrorCode = code
}

export interface ServerChatHealth {
  endpointConfigured: boolean
  provider: 'openai-server-proxy'
  mode: 'server'
  lastErrorCode: ServerChatErrorCode | null
}

export function checkServerChatHealth(): ServerChatHealth {
  return {
    endpointConfigured: ENDPOINT.length > 0,
    provider: 'openai-server-proxy',
    mode: 'server',
    lastErrorCode: _lastChatErrorCode,
  }
}
