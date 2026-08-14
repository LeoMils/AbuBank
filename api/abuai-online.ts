/*
 * AbuAI online current-info endpoint (B2)
 *
 * Server-side Vercel Edge function. Reads OPENAI_API_KEY from the server
 * environment (NOT from the client bundle). Calls OpenAI's Responses API
 * with the built-in `web_search` tool to answer current/live questions
 * (weather, news, cinema listings, "this week", "open now") that the
 * offline LLM cannot answer honestly.
 *
 * Hard rules:
 *   • The OpenAI API key is never sent to the client.
 *   • This endpoint refuses personal-looking queries (calendar / family /
 *     contacts) — those go through the local grounded path.
 *   • No raw env value is logged.
 *   • Short timeout. Clear typed error codes.
 */

import { selectProvider } from '../src/services/online/registry'
import { buildBriefing, speakableBriefing, type Briefing } from '../src/services/online/briefing'

export const config = { runtime: 'edge' }

interface OnlinePayload {
  query?: string
  lang?: 'he' | 'es' | 'en' | 'mixed'
  kind?: string
  locationHint?: string
}

// A briefing is NOT one query: "what is new", "מה חדש", "novedades" ⇒ fan out across
// Israel/world/culture/entertainment/society/health and return 10+ headlines with
// sources, holding the per-source snippets for a follow-up. Detected here so a plain
// current-info question still takes the fast single-answer path.
const BRIEFING_INTENT = /מה\s*(?:חדש|קורה|נשמע|מתחדש)|מה\s*החדשות|חדשות\s*היום|תעדכני\s*אותי|what\s*is\s*new|what'?s\s*new|latest\s*news|catch\s*me\s*up|qu[eé]\s*hay\s*de\s*nuevo|novedades|noticias\s*de\s*hoy/i
function isBriefingIntent(text: string, kind?: string): boolean {
  return kind === 'briefing' || BRIEFING_INTENT.test(text)
}

interface OnlineSource {
  title?: string
  url?: string
}

type OnlineErrorCode =
  | 'OPENAI_API_KEY_MISSING'
  | 'ONLINE_PROVIDER_FAILED'
  | 'ONLINE_QUERY_BLOCKED_PERSONAL'
  | 'ONLINE_TIMEOUT'
  | 'ONLINE_NO_RESULTS'
  | 'BAD_REQUEST'

/**
 * Non-secret diagnostic returned on EVERY response (and safe to log) so that a
 * misconfigured provider can NEVER again look identical to a search that found
 * nothing. It carries the RESOLVED provider, whether that provider's key was
 * present (boolean only — never the value), whether we actually reached the
 * upstream HTTP call, how many sources came back, and the outcome code. With
 * this, one request to the deployed endpoint tells you exactly why online failed.
 */
interface OnlineDiag {
  /** What ONLINE_PROVIDER was set to (lower-cased), or 'openai' if unset. */
  requested: string
  /** The provider actually selected (falls back to 'openai' for an unknown id). */
  provider: string
  /** Did the selected provider's key exist in the server env? (boolean only) */
  providerKeyPresent: boolean
  /** Is an OpenAI key present at all? (the incumbent path's key) */
  openaiKeyPresent: boolean
  /** Did we actually issue the upstream provider HTTP request? */
  reached: boolean
  /** Number of grounding sources returned (0 ⇒ honesty gate declines). */
  sourceCount: number
  /** 'ok' or the OnlineErrorCode this request resolved to. */
  outcome: string
}

interface OnlineSuccess {
  ok: true
  answer: string
  sources?: OnlineSource[]
  /** Present for briefing-intent queries: 10+ distinct headlines with held snippets. */
  briefing?: Briefing
  diag?: OnlineDiag
}
interface OnlineFailure {
  ok: false
  errorCode: OnlineErrorCode
  userMessage: string
  diag?: OnlineDiag
}
type OnlineResult = OnlineSuccess | OnlineFailure

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const OPENAI_MODEL = 'gpt-4o-mini'
const REQUEST_TIMEOUT_MS = 12_000

// Keep this list in sync with onlineIntent.ts. Server-side guard exists
// so the endpoint refuses personal queries even if a buggy client calls
// it without running the client-side intent check.
const PERSONAL_HE = /מה יש לי|תור שלי|שלי ביומן|בן\s*משפחה|הנכד שלי|הנכדה שלי|הבן שלי|הבת שלי|מתי הרופא הבא שלי|פפי|לאו|מור|אופיר|איילון|עילי|אדר|עדי|נועם|רפי|ירדן|גלעד|יעל/
const PERSONAL_ES = /qu[eé]\s+tengo\s+hoy|qu[eé]\s+tengo\s+ma[nñ]ana|h[aá]blame\s+de|cu[eé]ntame\s+de|qui[eé]n\s+es|mi\s+(?:nieto|nieta|hijo|hija)|mi\s+familia|mi\s+m[eé]dico/i
const PERSONAL_EN = /\bwhat\s+do\s+i\s+have\b|\btell\s+me\s+about\s+(?!italy|argentina|spain|france|germany|japan)|\bwho\s+is\s+(?!the\s+president|the\s+prime\s+minister)|\bmy\s+(?:grandson|granddaughter|son|daughter|family|doctor|appointment)\b/i

function isPersonal(text: string): boolean {
  return PERSONAL_HE.test(text) || PERSONAL_ES.test(text) || PERSONAL_EN.test(text)
}

function userMessageFor(code: OnlineErrorCode, lang: OnlinePayload['lang'] = 'he'): string {
  const ES: Record<OnlineErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'No puedo comprobar información online ahora porque la conexión de AI no está configurada.',
    ONLINE_PROVIDER_FAILED: 'No puedo comprobar información online ahora. Probá de nuevo en un momento.',
    ONLINE_QUERY_BLOCKED_PERSONAL: 'Para preguntas sobre tu familia o tu calendario, mejor usar la información local — no busco eso online.',
    ONLINE_TIMEOUT: 'La búsqueda online tardó demasiado. Probá de nuevo en un momento.',
    ONLINE_NO_RESULTS: 'No encontré información actual sobre eso ahora mismo. Prefiero decírtelo a inventar algo.',
    BAD_REQUEST: 'No entendí la consulta. Probá con otra pregunta.',
  }
  const HE: Record<OnlineErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'אני לא יכולה לבדוק מידע אונליין כרגע כי חיבור ה-AI לא מוגדר.',
    ONLINE_PROVIDER_FAILED: 'אני לא מצליחה לבדוק מידע אונליין כרגע. נסי שוב בעוד רגע.',
    ONLINE_QUERY_BLOCKED_PERSONAL: 'לשאלות על המשפחה או היומן אני משתמשת במידע המקומי — לא מחפשת את זה אונליין.',
    ONLINE_TIMEOUT: 'החיפוש האונליין לקח יותר מדי זמן. נסי שוב.',
    ONLINE_NO_RESULTS: 'לא מצאתי מידע עדכני על זה כרגע. אני מעדיפה להגיד לך את זה מאשר להמציא.',
    BAD_REQUEST: 'לא הבנתי את השאלה. נסי לנסח אחרת.',
  }
  const EN: Record<OnlineErrorCode, string> = {
    OPENAI_API_KEY_MISSING: 'I cannot check online information right now because the AI connection is not configured.',
    ONLINE_PROVIDER_FAILED: 'I cannot check online information right now. Please try again in a moment.',
    ONLINE_QUERY_BLOCKED_PERSONAL: 'For family or calendar questions I use local information — I do not search the web for those.',
    ONLINE_TIMEOUT: 'The online lookup took too long. Please try again.',
    ONLINE_NO_RESULTS: 'I could not find current information about that right now. I would rather tell you that than make something up.',
    BAD_REQUEST: 'I did not understand the question. Try rephrasing.',
  }
  switch (lang) {
    case 'es': return ES[code]
    case 'en': return EN[code]
    case 'mixed':
    case 'he':
    default: return HE[code]
  }
}

function jsonResponse(body: OnlineResult, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export default async function handler(req: Request): Promise<Response> {
  // Non-secret diagnostic threaded through every return. Enriched once the env +
  // provider are known. `respond` merges the CURRENT diag snapshot into the body.
  const diag: OnlineDiag = {
    requested: 'unset', provider: 'unknown', providerKeyPresent: false,
    openaiKeyPresent: false, reached: false, sourceCount: 0, outcome: 'pending',
  }
  const respond = (body: OnlineResult, status = 200): Response => {
    diag.outcome = body.ok ? 'ok' : body.errorCode
    return jsonResponse({ ...body, diag: { ...diag } }, status)
  }

  if (req.method !== 'POST') {
    return respond({ ok: false, errorCode: 'BAD_REQUEST', userMessage: userMessageFor('BAD_REQUEST', 'he') }, 405)
  }

  // Parse + validate
  let payload: OnlinePayload
  try {
    payload = (await req.json()) as OnlinePayload
  } catch {
    return respond({ ok: false, errorCode: 'BAD_REQUEST', userMessage: userMessageFor('BAD_REQUEST', 'he') }, 400)
  }
  const query = (payload.query ?? '').trim()
  const lang = payload.lang ?? 'he'
  if (!query || query.length < 2 || query.length > 600) {
    return respond({ ok: false, errorCode: 'BAD_REQUEST', userMessage: userMessageFor('BAD_REQUEST', lang) }, 400)
  }

  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}

  // Resolve the provider + key presence up front so the diagnostic is accurate on
  // EVERY exit path (including the personal-blocked one) — no secret values, only names/booleans.
  const providerId = (env.ONLINE_PROVIDER ?? 'openai').toLowerCase()
  const selected = selectProvider(env)
  diag.requested = env.ONLINE_PROVIDER ? providerId : 'unset'
  diag.provider = selected.id
  diag.providerKeyPresent = selected.available(env)
  diag.openaiKeyPresent = !!(env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY)

  // Server-side personal guard
  if (isPersonal(query)) {
    return respond({ ok: false, errorCode: 'ONLINE_QUERY_BLOCKED_PERSONAL', userMessage: userMessageFor('ONLINE_QUERY_BLOCKED_PERSONAL', lang) }, 200)
  }

  // ── BRIEFING branch (Item 3 · online depth) ────────────────────────────────
  // "What is new?" fans out across 6 topics and returns 10+ deduped headlines WITH
  // held snippets — provider-agnostic (uses the selected provider), behind the SAME
  // honesty gate: zero headlines ⇒ decline (never speak stale memory as fact). Only
  // runs when the selected provider is a real search provider with a present key.
  if (isBriefingIntent(query, payload.kind) && selected.id !== 'openai' && selected.available(env)) {
    diag.reached = true
    const briefing = await buildBriefing((q, l, e) => selected.search(q, l, e), env, { lang })
    diag.sourceCount = briefing.count
    if (briefing.count === 0) {
      return respond({ ok: false, errorCode: 'ONLINE_NO_RESULTS', userMessage: userMessageFor('ONLINE_NO_RESULTS', lang) }, 200)
    }
    const sources: OnlineSource[] = briefing.headlines.map((h) => (h.title ? { url: h.url, title: h.title } : { url: h.url }))
    return respond({ ok: true, answer: speakableBriefing(briefing), sources, briefing })
  }

  // ── Bake-off winner path (M2), selectable via ONLINE_PROVIDER ──────────────
  // The empirical tournament (docs/eval/ONLINE_BAKEOFF.json) proved the incumbent
  // OpenAI web_search is INADEQUATE for a voice product: 61% citation and 3.9s avg /
  // 8.85s p95. Tavily won on the two metrics that matter here — 100% citation and a
  // clean, speakable synthesized Hebrew answer at ~2s avg. `selectProvider(env)`
  // routes to the chosen provider; the DEFAULT stays 'openai' so production behaviour
  // and this endpoint's existing tests are unchanged until the env flips to the winner.
  // The SAME honesty gate applies: zero sources ⇒ ungrounded ⇒ decline (never speak
  // stale memory as fact). The provider key stays server-side (read from env here).
  if (providerId !== 'openai') {
    const provider = selected
    // selectProvider falls back to 'openai' for an unknown id → fall through below.
    if (provider.id !== 'openai') {
      if (!provider.available(env)) {
        // The winner was requested but its key is MISSING — an explicit, distinct
        // failure. This must NOT look like "found nothing" (the exact confusion the
        // diagnostic exists to end): reached=false, providerKeyPresent=false.
        return respond({ ok: false, errorCode: 'ONLINE_PROVIDER_FAILED', userMessage: userMessageFor('ONLINE_PROVIDER_FAILED', lang) }, 200)
      }
      diag.reached = true
      const r = await provider.search(query, lang, env)
      if (!r.ok) {
        const code: OnlineErrorCode = r.error === 'TIMEOUT' ? 'ONLINE_TIMEOUT' : 'ONLINE_PROVIDER_FAILED'
        return respond({ ok: false, errorCode: code, userMessage: userMessageFor(code, lang) }, 200)
      }
      diag.sourceCount = r.sources.length
      // Grounding gate — identical rule to the OpenAI path below.
      if (r.sources.length === 0) {
        return respond({ ok: false, errorCode: 'ONLINE_NO_RESULTS', userMessage: userMessageFor('ONLINE_NO_RESULTS', lang) }, 200)
      }
      // Strip any provider HTML so the answer is safe to speak (TTS), then require text.
      const winnerAnswer = (r.answer ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (!winnerAnswer) {
        return respond({ ok: false, errorCode: 'ONLINE_NO_RESULTS', userMessage: userMessageFor('ONLINE_NO_RESULTS', lang) }, 200)
      }
      const winnerSources: OnlineSource[] = r.sources.map((s) => (s.title ? { url: s.url, title: s.title } : { url: s.url }))
      return respond({ ok: true, answer: winnerAnswer, sources: winnerSources })
    }
  }

  // Read API key from server env. Never sent to the client.
  // We accept either OPENAI_API_KEY (preferred for server) or
  // VITE_OPENAI_API_KEY (legacy carry-over) so existing Vercel projects
  // that already configured the VITE_ name keep working without
  // re-deploy.
  const apiKey = env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    return respond({ ok: false, errorCode: 'OPENAI_API_KEY_MISSING', userMessage: userMessageFor('OPENAI_API_KEY_MISSING', lang) }, 200)
  }

  // Build the system instruction. Light, neutral, source-aware.
  const systemInstruction =
    `You are AbuAI's live-info helper. The user is an 80+ Spanish/Hebrew speaker living in Kfar Saba, Israel. ` +
    `Answer current/live questions (weather, news, cinema, "this week", "open now") in 2–4 sentences in the language of the question. ` +
    `Cite sources briefly when relevant. ` +
    `If the question is about family / personal calendar / contacts, refuse and redirect: "I do not look up personal information online." ` +
    `If web_search returns nothing useful, say honestly that you could not find current information.`

  // Call OpenAI Responses API with the built-in web_search tool.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  diag.reached = true
  let resp: globalThis.Response
  try {
    resp = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: systemInstruction,
        input: query,
        tools: [{ type: 'web_search' }],
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    const code: OnlineErrorCode = (err as { name?: string } | null)?.name === 'AbortError' ? 'ONLINE_TIMEOUT' : 'ONLINE_PROVIDER_FAILED'
    return respond({ ok: false, errorCode: code, userMessage: userMessageFor(code, lang) }, 200)
  }
  clearTimeout(timeout)

  if (!resp.ok) {
    return respond({ ok: false, errorCode: 'ONLINE_PROVIDER_FAILED', userMessage: userMessageFor('ONLINE_PROVIDER_FAILED', lang) }, 200)
  }

  let data: unknown
  try { data = await resp.json() } catch {
    return respond({ ok: false, errorCode: 'ONLINE_PROVIDER_FAILED', userMessage: userMessageFor('ONLINE_PROVIDER_FAILED', lang) }, 200)
  }

  // Extract `output_text` (Responses API convenience field) or fall back
  // to walking the structured output array. Sources come from the
  // tool_use citations when present.
  const answer = extractAnswerText(data)
  if (!answer) {
    return respond({ ok: false, errorCode: 'ONLINE_PROVIDER_FAILED', userMessage: userMessageFor('ONLINE_PROVIDER_FAILED', lang) }, 200)
  }
  const sources = extractSources(data)
  diag.sourceCount = sources.length

  // GROUNDING GATE (§47 / "NO TOOL RESULT = NO CLAIM"): a current-info answer must
  // carry evidence it came from web_search. If ZERO sources came back, we have no proof
  // the model actually retrieved anything — it may be answering from stale memory (the
  // real device incident: fabricated World Cup fixtures returned as ok:true). Never
  // surface that free text as a confident answer; return an honest failure instead so the
  // client shows a fixed "I could not find current info" line, not a possible hallucination.
  if (sources.length === 0) {
    return respond({ ok: false, errorCode: 'ONLINE_NO_RESULTS', userMessage: userMessageFor('ONLINE_NO_RESULTS', lang) }, 200)
  }

  return respond({ ok: true, answer, sources })
}

// ─── Helpers (loose typing — Responses API shape stabilising) ──────────────

function extractAnswerText(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const obj = data as Record<string, unknown>
  if (typeof obj.output_text === 'string' && obj.output_text.trim()) return obj.output_text.trim()
  // Fall back: walk obj.output -> []  -> .content -> [{ type:'output_text', text }]
  const out = obj.output
  if (Array.isArray(out)) {
    for (const item of out) {
      if (!item || typeof item !== 'object') continue
      const it = item as Record<string, unknown>
      const content = it.content
      if (!Array.isArray(content)) continue
      for (const part of content) {
        if (!part || typeof part !== 'object') continue
        const p = part as Record<string, unknown>
        if (p.type === 'output_text' && typeof p.text === 'string') return p.text.trim()
      }
    }
  }
  return ''
}

function extractSources(data: unknown): OnlineSource[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  const out = obj.output
  const sources: OnlineSource[] = []
  if (!Array.isArray(out)) return sources
  for (const item of out) {
    if (!item || typeof item !== 'object') continue
    const it = item as Record<string, unknown>
    const content = it.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      if (!part || typeof part !== 'object') continue
      const p = part as Record<string, unknown>
      const annotations = p.annotations
      if (!Array.isArray(annotations)) continue
      for (const a of annotations) {
        if (!a || typeof a !== 'object') continue
        const ann = a as Record<string, unknown>
        if (ann.type === 'url_citation' && typeof ann.url === 'string') {
          const src: OnlineSource = { url: ann.url }
          if (typeof ann.title === 'string') src.title = ann.title
          sources.push(src)
        }
      }
    }
  }
  return sources
}
