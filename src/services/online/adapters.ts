/*
 * adapters.ts — the four bake-off candidates behind one interface (M1).
 * ════════════════════════════════════════════════════════════════════════════
 * openai   — the incumbent (Responses API web_search). VERIFIED against the real key.
 * tavily   — search API with a synthesized answer + sources. CODE (needs TAVILY_API_KEY).
 * brave    — web search results (no synthesized answer). CODE (needs BRAVE_API_KEY).
 * perplexity — Sonar: answer + citations. CODE (needs PERPLEXITY_API_KEY).
 * Each is server-only, never throws, and reports latency. Grounding = sources.length.
 */
import { type OnlineProvider, type ProviderResult, type ProviderSource, type Env, nowMs } from './providerTypes'

const TIMEOUT_MS = 15_000

async function fetchWithTimeout(url: string, init: RequestInit, ms = TIMEOUT_MS): Promise<Response> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try { return await fetch(url, { ...init, signal: c.signal }) } finally { clearTimeout(t) }
}

function fail(started: number, error: string): ProviderResult {
  return { ok: false, sources: [], latencyMs: Math.round(nowMs() - started), error }
}

// ─── OpenAI Responses web_search (incumbent) ───────────────────────────────────
function openaiExtract(data: unknown): { answer: string; sources: ProviderSource[] } {
  const obj = (data ?? {}) as Record<string, unknown>
  let answer = typeof obj.output_text === 'string' ? obj.output_text.trim() : ''
  const sources: ProviderSource[] = []
  const out = obj.output
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = (item as Record<string, unknown>)?.content
      if (!Array.isArray(content)) continue
      for (const part of content) {
        const p = part as Record<string, unknown>
        if (!answer && p?.type === 'output_text' && typeof p.text === 'string') answer = p.text.trim()
        const anns = p?.annotations
        if (Array.isArray(anns)) for (const a of anns) {
          const ann = a as Record<string, unknown>
          if (ann?.type === 'url_citation' && typeof ann.url === 'string') sources.push({ url: ann.url, ...(typeof ann.title === 'string' ? { title: ann.title } : {}) })
        }
      }
    }
  }
  return { answer, sources }
}

export const openaiProvider: OnlineProvider = {
  id: 'openai', keyEnv: 'OPENAI_API_KEY',
  available: (env) => !!(env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY),
  async search(query, lang, env) {
    const started = nowMs()
    const key = env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY
    if (!key) return fail(started, 'NO_KEY')
    try {
      const res = await fetchWithTimeout('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', instructions: `Answer the ${lang} question from current web results in 2-3 sentences; cite sources.`, input: query, tools: [{ type: 'web_search' }] }),
      })
      if (!res.ok) return fail(started, 'PROVIDER_FAILED')
      const { answer, sources } = openaiExtract(await res.json())
      return { ok: true, answer, sources, latencyMs: Math.round(nowMs() - started) }
    } catch (e) { return fail(started, (e as { name?: string })?.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_FAILED') }
  },
}

// ─── Tavily ────────────────────────────────────────────────────────────────────
export const tavilyProvider: OnlineProvider = {
  id: 'tavily', keyEnv: 'TAVILY_API_KEY',
  available: (env) => !!env.TAVILY_API_KEY,
  async search(query, _lang, env) {
    const started = nowMs()
    const key = env.TAVILY_API_KEY
    if (!key) return fail(started, 'NO_KEY')
    try {
      // topic defaults to 'general'. Do NOT pin topic:'news' — that restricts Tavily to
      // recent news ARTICLES and returns ZERO results for the non-news current questions
      // this endpoint also serves (dollar rate, opening hours, shabbat times, holiday
      // dates). Zero results ⇒ the honesty gate declines ⇒ looks identical to a real
      // "found nothing". A general search still answers news queries AND those. (regression:
      // adapters.test.ts asserts no topic:'news' pin.)
      // Use the FULL results, not just the one-line answer: raise max_results and
      // KEEP each result's `content` snippet — that per-source depth is what turns a
      // headline into a briefing and answers a follow-up ("tell me more about #3")
      // from the SAME retrieval instead of a new query. (Item 3 · online depth.)
      const res = await fetchWithTimeout('https://api.tavily.com/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, search_depth: 'basic', include_answer: true, max_results: 10 }),
      })
      if (!res.ok) return fail(started, 'PROVIDER_FAILED')
      const d = (await res.json()) as { answer?: string; results?: Array<{ title?: string; url?: string; content?: string }> }
      const sources: ProviderSource[] = (d.results ?? []).filter((r) => typeof r.url === 'string').map((r) => ({
        url: r.url!,
        ...(r.title ? { title: r.title } : {}),
        ...(r.content ? { content: String(r.content).replace(/\s+/g, ' ').trim() } : {}),
      }))
      return { ok: true, answer: typeof d.answer === 'string' ? d.answer.trim() : '', sources, latencyMs: Math.round(nowMs() - started) }
    } catch (e) { return fail(started, (e as { name?: string })?.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_FAILED') }
  },
}

// ─── Brave Search (results only; no synthesized answer) ────────────────────────
export const braveProvider: OnlineProvider = {
  id: 'brave', keyEnv: 'BRAVE_API_KEY',
  available: (env) => !!env.BRAVE_API_KEY,
  async search(query, _lang, env) {
    const started = nowMs()
    const key = env.BRAVE_API_KEY
    if (!key) return fail(started, 'NO_KEY')
    try {
      // NOTE: Brave's `country` enum does NOT include Israel (IL) — passing country=IL
      // returns 422 Unprocessable Entity (verified against the live key). Omit country
      // and let Brave geolocate; `search_lang=he` still yields Hebrew results.
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&search_lang=he&count=6`
      const res = await fetchWithTimeout(url, { method: 'GET', headers: { Accept: 'application/json', 'X-Subscription-Token': key } })
      if (!res.ok) return fail(started, 'PROVIDER_FAILED')
      const d = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } }
      const results = d.web?.results ?? []
      const sources: ProviderSource[] = results.filter((r) => typeof r.url === 'string').map((r) => ({
        url: r.url!,
        ...(r.title ? { title: r.title } : {}),
        ...(r.description ? { content: String(r.description).replace(/\s+/g, ' ').trim() } : {}),
      }))
      // Brave returns no synthesized answer; hand back the top snippet as context.
      const answer = results[0]?.description ? String(results[0].description).trim() : ''
      return { ok: true, answer, sources, latencyMs: Math.round(nowMs() - started) }
    } catch (e) { return fail(started, (e as { name?: string })?.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_FAILED') }
  },
}

// ─── Perplexity Sonar (answer + citations) ─────────────────────────────────────
export const perplexityProvider: OnlineProvider = {
  id: 'perplexity', keyEnv: 'PERPLEXITY_API_KEY',
  available: (env) => !!env.PERPLEXITY_API_KEY,
  async search(query, _lang, env) {
    const started = nowMs()
    const key = env.PERPLEXITY_API_KEY
    if (!key) return fail(started, 'NO_KEY')
    try {
      const res = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: query }] }),
      })
      if (!res.ok) return fail(started, 'PROVIDER_FAILED')
      const d = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; citations?: string[] }
      const answer = d.choices?.[0]?.message?.content?.trim() ?? ''
      const sources: ProviderSource[] = (d.citations ?? []).filter((u) => typeof u === 'string').map((u) => ({ url: u }))
      return { ok: true, answer, sources, latencyMs: Math.round(nowMs() - started) }
    } catch (e) { return fail(started, (e as { name?: string })?.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_FAILED') }
  },
}
