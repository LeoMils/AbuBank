/*
 * AbuAI news endpoint — Israel-primary, Hebrew, GROUNDED current headlines.
 * ════════════════════════════════════════════════════════════════════════════
 * Server-side Vercel Edge function. Same discipline as api/abuai-online.ts: the
 * OPENAI_API_KEY is read from the SERVER env (never the client bundle), a short
 * timeout, typed error codes, and — critically — a GROUNDING GATE. It calls the
 * OpenAI Responses API with the built-in web_search tool and asks for a small set
 * of current stories as STRUCTURED JSON (headline + plain-Hebrew summary + source
 * + url + time).
 *
 * Honesty invariants ("never fabricate a story, a quote, a number or a source"):
 *   • A story is kept ONLY if it has a headline, a summary, a source name, a real
 *     url, AND a time — anything missing is dropped, never shown half-blank.
 *   • The whole response is trusted ONLY if web_search actually cited sources
 *     (≥1 url_citation). Zero citations ⇒ the model may be answering from memory
 *     ⇒ honest failure (NEWS_NO_RESULTS), never stale/invented content as if fresh.
 *   • On any failure: ok:false + an honest Hebrew/Spanish/English line, no stories.
 */

import { type NewsStory, isCompleteStory } from '../src/screens/AbuNews/newsTypes'

export const config = { runtime: 'edge' }

interface NewsPayload { lang?: 'he' | 'es' | 'en'; limit?: number }

type NewsErrorCode =
  | 'OPENAI_API_KEY_MISSING'
  | 'NEWS_PROVIDER_FAILED'
  | 'NEWS_TIMEOUT'
  | 'NEWS_NO_RESULTS'
  | 'BAD_REQUEST'

interface NewsSuccess { ok: true; stories: NewsStory[]; retrievedAt: string }
interface NewsFailure { ok: false; errorCode: NewsErrorCode; userMessage: string }
type NewsResult = NewsSuccess | NewsFailure

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = 'gpt-4o-mini'
const REQUEST_TIMEOUT_MS = 15_000
const MAX_STORIES = 8

function userMessageFor(code: NewsErrorCode, lang: NewsPayload['lang'] = 'he'): string {
  const HE: Record<NewsErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'אני לא יכולה להביא חדשות כרגע כי חיבור ה-AI לא מוגדר.',
    NEWS_PROVIDER_FAILED: 'לא הצלחתי להביא חדשות עדכניות כרגע. ננסה שוב בעוד רגע.',
    NEWS_TIMEOUT: 'הבאת החדשות לקחה יותר מדי זמן. ננסה שוב.',
    NEWS_NO_RESULTS: 'לא מצאתי חדשות עדכניות עם מקור אמין כרגע. אני מעדיפה להגיד לך את זה מאשר להראות משהו לא בטוח.',
    BAD_REQUEST: 'לא הבנתי את הבקשה.',
  }
  const ES: Record<NewsErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'No puedo traer noticias ahora porque la conexión de AI no está configurada.',
    NEWS_PROVIDER_FAILED: 'No pude traer noticias actuales ahora. Probamos de nuevo en un momento.',
    NEWS_TIMEOUT: 'Traer las noticias tardó demasiado. Probamos de nuevo.',
    NEWS_NO_RESULTS: 'No encontré noticias actuales con una fuente confiable ahora. Prefiero decírtelo a mostrarte algo dudoso.',
    BAD_REQUEST: 'No entendí el pedido.',
  }
  const EN: Record<NewsErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'I cannot fetch the news right now because the AI connection is not configured.',
    NEWS_PROVIDER_FAILED: 'I could not fetch current news right now. Let us try again in a moment.',
    NEWS_TIMEOUT: 'Fetching the news took too long. Let us try again.',
    NEWS_NO_RESULTS: 'I could not find current news with a reliable source right now. I would rather tell you that than show something unverified.',
    BAD_REQUEST: 'I did not understand the request.',
  }
  return lang === 'es' ? ES[code] : lang === 'en' ? EN[code] : HE[code]
}

function jsonResponse(body: NewsResult, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

import { guardBillable } from './_session'

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ ok: false, errorCode: 'BAD_REQUEST', userMessage: userMessageFor('BAD_REQUEST', 'he') }, 405)
  // Server-verifiable auth (when configured): an unauthenticated caller gets 401 BEFORE any provider call.
  { const denied = await guardBillable(req); if (denied) return denied }

  let payload: NewsPayload
  try { payload = (await req.json()) as NewsPayload }
  catch { return jsonResponse({ ok: false, errorCode: 'BAD_REQUEST', userMessage: userMessageFor('BAD_REQUEST', 'he') }, 400) }
  const lang = payload.lang ?? 'he'
  const limit = Math.min(Math.max(Number(payload.limit) || MAX_STORIES, 1), MAX_STORIES)

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}
  // SERVER-ONLY name only — no VITE_ fallback (fail closed). See P0 incident 2026-08-16.
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) return jsonResponse({ ok: false, errorCode: 'OPENAI_API_KEY_MISSING', userMessage: userMessageFor('OPENAI_API_KEY_MISSING', lang) }, 200)

  const instruction =
    `You are AbuAI's news helper for an 80-year-old Hebrew/Spanish speaker in Kfar Saba, Israel. ` +
    `Use web_search to find TODAY'S real current headlines. Israel news FIRST, then a little world news. ` +
    `Return ONLY a JSON object of the exact shape {"stories":[{"headline":"","summary":"","source":"","url":"","published":""}]}. ` +
    `Every field in Hebrew EXCEPT url. headline: short, scannable, plain. summary: 1–2 plain Hebrew sentences an 80-year-old understands, no jargon, no clickbait. ` +
    `source: the outlet name. url: the real article link you actually retrieved. published: a human time like "לפני שעה" or a date. ` +
    `Include ONLY stories you actually retrieved with a real source and link — NEVER invent a story, a source, a number or a link. ` +
    `Up to ${limit} stories.`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let resp: Response
  try {
    resp = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, instructions: instruction, input: 'הבא לי את החדשות המרכזיות של היום.', tools: [{ type: 'web_search' }] }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    const code: NewsErrorCode = (err as { name?: string } | null)?.name === 'AbortError' ? 'NEWS_TIMEOUT' : 'NEWS_PROVIDER_FAILED'
    return jsonResponse({ ok: false, errorCode: code, userMessage: userMessageFor(code, lang) }, 200)
  }
  clearTimeout(timeout)
  if (!resp.ok) return jsonResponse({ ok: false, errorCode: 'NEWS_PROVIDER_FAILED', userMessage: userMessageFor('NEWS_PROVIDER_FAILED', lang) }, 200)

  let data: unknown
  try { data = await resp.json() } catch { return jsonResponse({ ok: false, errorCode: 'NEWS_PROVIDER_FAILED', userMessage: userMessageFor('NEWS_PROVIDER_FAILED', lang) }, 200) }

  // GROUNDING GATE: web_search must have cited at least one source, else we cannot
  // trust the output was retrieved (it may be model memory) — honest failure.
  if (!hasCitations(data)) return jsonResponse({ ok: false, errorCode: 'NEWS_NO_RESULTS', userMessage: userMessageFor('NEWS_NO_RESULTS', lang) }, 200)

  const stories = extractStories(data).filter(isCompleteStory).slice(0, limit)
  if (stories.length === 0) return jsonResponse({ ok: false, errorCode: 'NEWS_NO_RESULTS', userMessage: userMessageFor('NEWS_NO_RESULTS', lang) }, 200)

  return jsonResponse({ ok: true, stories, retrievedAt: new Date().toISOString() })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function outputText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const obj = data as Record<string, unknown>
  if (typeof obj.output_text === 'string' && obj.output_text.trim()) return obj.output_text.trim()
  const out = obj.output
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = (item as Record<string, unknown>)?.content
      if (!Array.isArray(content)) continue
      for (const part of content) {
        const p = part as Record<string, unknown>
        if (p?.type === 'output_text' && typeof p.text === 'string') return p.text.trim()
      }
    }
  }
  return ''
}

/** Parse the model's JSON payload into stories (strips ``` fences; tolerant). */
export function extractStories(data: unknown): NewsStory[] {
  const text = outputText(data)
  if (!text) return []
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  let parsed: unknown
  try { parsed = JSON.parse(cleaned) } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) return []
    try { parsed = JSON.parse(m[0]) } catch { return [] }
  }
  const arr = (parsed as { stories?: unknown })?.stories
  if (!Array.isArray(arr)) return []
  return arr as NewsStory[]
}

/** True if the raw response carries ≥1 web_search url_citation (proof of retrieval). */
export function hasCitations(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const out = (data as Record<string, unknown>).output
  if (!Array.isArray(out)) return false
  for (const item of out) {
    const content = (item as Record<string, unknown>)?.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      const annotations = (part as Record<string, unknown>)?.annotations
      if (Array.isArray(annotations) && annotations.some((a) => (a as Record<string, unknown>)?.type === 'url_citation')) return true
    }
  }
  return false
}
