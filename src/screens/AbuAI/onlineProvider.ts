/*
 * AbuAI online-provider client (B2)
 *
 * Talks to the server-side endpoint /api/abuai-online so the OpenAI key
 * stays on the server. Wraps fetch with a short client timeout, maps
 * structured error codes to user-facing copy, and exposes a simple
 * `checkOnlineProviderHealth()` for the operator diagnostics surface.
 *
 * No secrets are read or logged here.
 */

import { shouldBlockOnlineForPersonal, isOnlineCurrentInfoQuery, getOnlineQueryKind } from './onlineIntent'

// Simple stale-while-revalidate cache for online answers (weather safe for 30min)
const _onlineCache = new Map<string, { answer: string; sources: Array<{ title?: string; url?: string }>; ts: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getCachedAnswer(kind: string): { answer: string; sources: Array<{ title?: string; url?: string }> } | null {
  const entry = _onlineCache.get(kind)
  if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return { answer: entry.answer, sources: entry.sources }
  return null
}

function setCachedAnswer(kind: string, answer: string, sources: Array<{ title?: string; url?: string }>) {
  _onlineCache.set(kind, { answer, sources, ts: Date.now() })
}

/** Clear the online cache — used by tests. */
export function _clearOnlineCache() { _onlineCache.clear() }

export type OnlineLang = 'he' | 'es' | 'en' | 'mixed'

export type OnlineErrorCode =
  | 'OPENAI_API_KEY_MISSING'
  | 'ONLINE_PROVIDER_FAILED'
  | 'ONLINE_QUERY_BLOCKED_PERSONAL'
  | 'ONLINE_TIMEOUT'
  | 'BAD_REQUEST'
  | 'CLIENT_NETWORK_ERROR'

export interface OnlineSource {
  title?: string
  url?: string
}

/** Non-secret endpoint diagnostic (mirror of api/abuai-online OnlineDiag). Provider
 *  name + booleans + counts only — never a key value. */
export interface OnlineDiag {
  requested: string; provider: string; providerKeyPresent: boolean
  openaiKeyPresent: boolean; reached: boolean; sourceCount: number; outcome: string
}
let _lastOnlineDiag: OnlineDiag | null = null
/** The last non-secret online diagnostic (for the operator diagnostics surface). */
export function lastOnlineDiag(): OnlineDiag | null { return _lastOnlineDiag }

export interface OnlineSuccessResult {
  ok: true
  answer: string
  sources?: OnlineSource[]
  userMessage: string
}
export interface OnlineFailureResult {
  ok: false
  errorCode: OnlineErrorCode
  userMessage: string
}
export type OnlineResult = OnlineSuccessResult | OnlineFailureResult

export interface AnswerOnlineOptions {
  lang?: OnlineLang
  kind?: string
  locationHint?: string
  /** Test/storybook hook — bypass real fetch. */
  fetchImpl?: typeof fetch
  /** Test override — control timeout in ms. */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 14_000
const ENDPOINT = '/api/abuai-online'

/**
 * Category-specific honest fallback messages when the online endpoint fails.
 * Instead of a generic "I can't check", tell Martita exactly WHAT we couldn't check.
 */
function getHonestFallback(kind: string, lang: string): string {
  const fallbacks: Record<string, Record<string, string>> = {
    weather: {
      he: 'אני לא מצליחה לבדוק מזג אוויר כרגע. תנסי שוב עוד כמה דקות.',
      es: 'No puedo revisar el clima ahora. Probá de nuevo en un ratito.',
    },
    news: {
      he: 'אני לא מצליחה לגשת לחדשות כרגע. תנסי שוב מאוחר יותר.',
      es: 'No puedo ver las noticias ahora. Probá más tarde.',
    },
    sports: {
      he: 'אני לא מצליחה לבדוק תוצאות ספורט כרגע.',
      es: 'No puedo revisar resultados deportivos ahora.',
    },
    movies: {
      he: 'אני לא מצליחה לבדוק מה מקרינים כרגע. תנסי שוב מאוחר יותר.',
      es: 'No puedo ver la cartelera ahora. Probá después.',
    },
    general_current: {
      he: 'אני לא מצליחה לבדוק שערים ומחירים כרגע. תנסי שוב מאוחר יותר.',
      es: 'No puedo revisar cotizaciones ahora. Probá más tarde.',
    },
    holidays: {
      he: 'אני לא מצליחה לבדוק תאריכי חגים כרגע. תנסי שוב מאוחר יותר.',
      es: 'No puedo revisar fechas de feriados ahora. Probá más tarde.',
    },
  }
  return fallbacks[kind]?.[lang] ?? fallbacks[kind]?.he ?? 'אני לא מצליחה לבדוק את זה כרגע.'
}

function userMessageFor(code: OnlineErrorCode, lang: OnlineLang = 'he'): string {
  const ES: Record<OnlineErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'No puedo comprobar información online ahora porque la conexión de AI no está configurada.',
    ONLINE_PROVIDER_FAILED: 'No puedo comprobar información online ahora. Probá de nuevo en un momento.',
    ONLINE_QUERY_BLOCKED_PERSONAL: 'Para preguntas sobre tu familia o tu calendario, mejor usar la información local — no busco eso online.',
    ONLINE_TIMEOUT: 'La búsqueda online tardó demasiado. Probá de nuevo.',
    BAD_REQUEST: 'No entendí la consulta. Probá con otra pregunta.',
    CLIENT_NETWORK_ERROR: 'No tengo conexión ahora. Probá cuando vuelva el internet.',
  }
  const HE: Record<OnlineErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'לא הצלחתי לחפש אונליין כרגע. דברי עם לאו.',
    ONLINE_PROVIDER_FAILED: 'החיפוש לא עבד הפעם. ננסה שוב?',
    ONLINE_QUERY_BLOCKED_PERSONAL: 'על המשפחה והיומן אני עונה ממה שאני יודעת — לא צריך לחפש אונליין.',
    ONLINE_TIMEOUT: 'החיפוש לקח יותר מדי זמן. ננסה שוב?',
    BAD_REQUEST: 'לא הבנתי. תנסי לשאול אחרת?',
    CLIENT_NETWORK_ERROR: 'אין אינטרנט כרגע. ננסה שוב כשיחזור.',
  }
  const EN: Record<OnlineErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'I cannot check online information right now because the AI connection is not configured.',
    ONLINE_PROVIDER_FAILED: 'I cannot check online information right now. Please try again in a moment.',
    ONLINE_QUERY_BLOCKED_PERSONAL: 'For family or calendar questions I use local information — I do not search the web for those.',
    ONLINE_TIMEOUT: 'The online lookup took too long. Please try again.',
    BAD_REQUEST: 'I did not understand the question. Try rephrasing.',
    CLIENT_NETWORK_ERROR: 'No connection right now. Please try again when the internet is back.',
  }
  if (lang === 'es') return ES[code]
  if (lang === 'en') return EN[code]
  return HE[code]
}

/**
 * Calls the server endpoint with the user's query. Always returns a
 * typed OnlineResult — never throws to the caller.
 */
export async function answerOnlineCurrentInfo(
  query: string,
  options: AnswerOnlineOptions = {},
): Promise<OnlineResult> {
  const lang: OnlineLang = options.lang ?? 'he'
  const queryKind = getOnlineQueryKind(query)
  // Cache key = kind + the SPECIFIC query. Keying by kind alone collapsed different
  // questions of the same kind ("who is the PM" vs "who is the president" → both
  // general_current) into one cached answer — the "repeated identical answers to
  // different questions" bug. An identical repeat still hits the cache.
  const cacheKey = queryKind ? `${queryKind}::${query.trim().replace(/\s+/g, ' ').toLowerCase()}` : null
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const f = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) {
    return {
      ok: false,
      errorCode: 'CLIENT_NETWORK_ERROR',
      userMessage: queryKind ? getHonestFallback(queryKind, lang) : userMessageFor('CLIENT_NETWORK_ERROR', lang),
    }
  }

  // Client-side personal guard. Belt-and-suspenders — the server also
  // refuses, but we never make the network call for personal queries.
  if (shouldBlockOnlineForPersonal(query)) {
    return {
      ok: false,
      errorCode: 'ONLINE_QUERY_BLOCKED_PERSONAL',
      userMessage: userMessageFor('ONLINE_QUERY_BLOCKED_PERSONAL', lang),
    }
  }
  // Stale-while-revalidate: return cached answer if fresh (same kind AND same query).
  if (cacheKey) {
    const cached = getCachedAnswer(cacheKey)
    if (cached) {
      return { ok: true, answer: cached.answer, userMessage: cached.answer, sources: cached.sources }
    }
  }

  if (!query.trim() || query.length > 600) {
    return {
      ok: false,
      errorCode: 'BAD_REQUEST',
      userMessage: userMessageFor('BAD_REQUEST', lang),
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let resp: Response
  try {
    resp = await f(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        lang,
        ...(options.kind ? { kind: options.kind } : {}),
        ...(options.locationHint ? { locationHint: options.locationHint } : {}),
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    const isAbort = (err as { name?: string } | null)?.name === 'AbortError'
    const code: OnlineErrorCode = isAbort ? 'ONLINE_TIMEOUT' : 'CLIENT_NETWORK_ERROR'
    return { ok: false, errorCode: code, userMessage: queryKind ? getHonestFallback(queryKind, lang) : userMessageFor(code, lang) }
  }
  clearTimeout(timer)

  let data: unknown
  try { data = await resp.json() } catch {
    return {
      ok: false,
      errorCode: 'ONLINE_PROVIDER_FAILED',
      userMessage: queryKind ? getHonestFallback(queryKind, lang) : userMessageFor('ONLINE_PROVIDER_FAILED', lang),
    }
  }

  // Capture + log the endpoint's non-secret diagnostic BEFORE branching on ok/failure,
  // so a device trace records which provider ran, whether its key was present, and
  // whether the upstream call was reached — a misconfigured provider must never look
  // identical to a search that found nothing.
  if (data && typeof data === 'object' && (data as Record<string, unknown>).diag) {
    _lastOnlineDiag = (data as { diag: OnlineDiag }).diag
    try { console.info('[abuai-online-diag]', JSON.stringify(_lastOnlineDiag)) } catch { /* */ }
  }

  // Server responses are already shaped as { ok: true, answer, sources? }
  // or { ok: false, errorCode, userMessage }.
  if (data && typeof data === 'object' && (data as Record<string, unknown>).ok === true) {
    const body = data as { ok: true; answer?: unknown; sources?: unknown }
    if (typeof body.answer === 'string' && body.answer.trim().length > 0) {
      const sources = Array.isArray(body.sources) ? body.sources as OnlineSource[] : undefined
      const success: OnlineSuccessResult = {
        ok: true,
        answer: body.answer.trim(),
        userMessage: body.answer.trim(),
        ...(sources && sources.length > 0 ? { sources } : {}),
      }
      // Cache successful answer for stale-while-revalidate (keyed by kind + query)
      if (cacheKey) setCachedAnswer(cacheKey, success.answer, sources ?? [])
      return success
    }
  }
  if (data && typeof data === 'object' && (data as Record<string, unknown>).ok === false) {
    const body = data as { errorCode?: unknown; userMessage?: unknown }
    const code = (typeof body.errorCode === 'string'
      ? body.errorCode
      : 'ONLINE_PROVIDER_FAILED') as OnlineErrorCode
    return {
      ok: false,
      errorCode: code,
      userMessage: typeof body.userMessage === 'string' && body.userMessage.length > 0
        ? body.userMessage
        : userMessageFor(code, lang),
    }
  }

  return {
    ok: false,
    errorCode: 'ONLINE_PROVIDER_FAILED',
    userMessage: queryKind ? getHonestFallback(queryKind, lang) : userMessageFor('ONLINE_PROVIDER_FAILED', lang),
  }
}

// ─── Health ────────────────────────────────────────────────────────────────

export type OnlineProviderMode = 'server' | 'client' | 'fallback'

export interface OnlineProviderHealth {
  /** Whether the live-info endpoint URL is configured (path exists by
   *  convention; the actual upstream key only the server can check). */
  endpointConfigured: boolean
  /** Provider name. Today the only online provider is OpenAI. */
  provider: 'openai'
  /** Where the API call originates. Always 'server' in B2. */
  mode: OnlineProviderMode
  /** Last failure code observed by `answerOnlineCurrentInfo`. */
  lastErrorCode: OnlineErrorCode | null
  /** Last non-secret endpoint diagnostic (provider selected, key present, reached). */
  lastDiag: OnlineDiag | null
}

let _lastErrorCode: OnlineErrorCode | null = null

/** Records the last error code so the operator diag can show it. */
export function _recordOnlineError(code: OnlineErrorCode | null): void {
  _lastErrorCode = code
}

/**
 * Returns a synchronous health snapshot for the operator diagnostics
 * surface. Does NOT call the network; only reflects local state and
 * whether the endpoint URL is configured. Never returns secrets.
 */
export function checkOnlineProviderHealth(): OnlineProviderHealth {
  return {
    endpointConfigured: ENDPOINT.length > 0,
    provider: 'openai',
    mode: 'server',
    lastErrorCode: _lastErrorCode,
    lastDiag: _lastOnlineDiag,
  }
}

// Re-export the helper for runtime callers.
export { isOnlineCurrentInfoQuery }
