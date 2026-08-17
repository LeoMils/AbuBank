/*
 * providerTypes.ts — the online-provider abstraction for the bake-off (M1).
 * ════════════════════════════════════════════════════════════════════════════
 * One interface every candidate implements so the endpoint can swap the winner
 * behind the SAME shape, and so the empirical tournament (scripts/online-bakeoff)
 * scores them apples-to-apples. Providers are SERVER-ONLY (they hold keys); the
 * client never imports this. The honesty gate lives at the endpoint: a result with
 * zero sources is NOT a grounded answer.
 */
export interface ProviderSource {
  title?: string
  url: string
  /** Per-source snippet/content from the provider results array. This is the DEPTH
   *  that a one-line synthesized `answer` throws away — a briefing and follow-ups
   *  ("tell me more about #3") are built from these, not just the headline. */
  content?: string
  /** Publication/update timestamp from the provider (Tavily `published_date`, Brave `page_age`),
   *  when present. This is the FRESHNESS EVIDENCE a temporal/latest/news answer needs: it is carried
   *  search → evidence → synthesis → answer → freshness oracle so "grounded" can become "current"
   *  only when a recent dated source supports it. Raw provider string (ISO or date); never invented. */
  publishedDate?: string
}

export interface ProviderResult {
  /** true only if the call completed (not that it was grounded — check sources). */
  ok: boolean
  /** the synthesized answer text, if the provider returns one. */
  answer?: string
  /** grounding: the real sources cited. Zero ⇒ ungrounded ⇒ the endpoint declines. */
  sources: ProviderSource[]
  /** wall-clock latency of the call (ms) — this feeds a VOICE turn, so it matters. */
  latencyMs: number
  /** 'TIMEOUT' | 'PROVIDER_FAILED' | 'NO_KEY' when ok is false. */
  error?: string
}

export type Env = Record<string, string | undefined>

export interface OnlineProvider {
  /** stable id used in the matrix + endpoint selection (ONLINE_PROVIDER). */
  id: string
  /** the env var that must be present for this provider to run. */
  keyEnv: string
  /** true when the key is present (else the bake-off records it BLOCKED, never faked). */
  available(env: Env): boolean
  /** run one query. Never throws — failures come back as ok:false + an error code. */
  search(query: string, lang: string, env: Env): Promise<ProviderResult>
}

/** Small helper: the current monotonic-ish clock, tolerant of test environments. */
export function nowMs(): number {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
}
