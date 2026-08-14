/*
 * AbuBank /api/health — platform health endpoint (P0).
 *
 * Returns whether the deployed runtime is actually wired:
 *   • Which server-side env vars are present (NAMES ONLY — never values).
 *   • Which API routes are configured (existence is implicit; we list
 *     them for the client diagnostic panel).
 *   • Server time + build version, so the client can detect a stale
 *     PWA bundle.
 *
 * Truth Contract:
 *   • Never returns a secret value. Only "present" | "missing".
 *   • `ok` is true ONLY when every required env var is present.
 *
 * This is a public diagnostic endpoint. It exposes ONLY presence
 * booleans plus the public build identity — nothing sensitive.
 */

import { REALTIME_MODEL } from '../src/services/realtimeModel'

export const config = { runtime: 'edge' }

interface HealthResponse {
  ok: boolean
  buildVersion: string
  buildLabel: string
  serverTime: string
  realtimeModel: string
  env: {
    OPENAI_API_KEY: 'present' | 'missing'
  }
  routes: {
    abuaiChat: 'configured'
    abuaiOnline: 'configured'
    voiceTranscribe: 'client_direct_groq'
  }
}

// Hardcoded build identity for the server response. Must be kept in sync
// with src/version.ts at deploy time. The client diagnostic panel
// compares this to its bundled version to detect a stale PWA on the
// user's phone.
const BUILD_VERSION = '0.238.0-online-depth'
const BUILD_LABEL = 'AbuBank 0.238.0 — ONLINE DEPTH (Item 3). Root cause fixed: ProviderSource now carries per-source content (the depth the one-line answer discarded); the Tavily adapter keeps each result content + raises max_results to 10; Brave carries its description too. New briefing.ts fans a briefing across Israel/world/culture/entertainment/society/health (NO sports, NO economics), dedups by URL, returns 10+ distinct headlines each with source + held snippet, and answers a follow-up from the SAME retrieval (detailFor) or says so honestly. Wired into api/abuai-online.ts behind a briefing intent and the SAME zero-source honesty gate. REAL keyed probe (PREVIEW): before = 1 line / 6 url-only sources; AFTER = 12 distinct headlines, 12/12 with snippets, 9 hosts, all 6 categories. Provider health: Brave + Perplexity LIVE; Tavily key DEAD (HTTP 401 — rotate); OpenAI key present. Cinema: real sources found (cinema-city.co.il Kfar Saba, seret.co.il) but reliable structured showtimes need a dedicated adapter — honest cannot until then. Mutant briefing-headline-without-a-source KILLED. Evidence: online tests green + real probe + full suite + build. Prior: cost controls (v0.237).'

export default function handler(_req: Request): Response {
  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}
  const openaiPresent = typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.length > 0
  const body: HealthResponse = {
    ok: openaiPresent,
    buildVersion: BUILD_VERSION,
    buildLabel: BUILD_LABEL,
    serverTime: new Date().toISOString(),
    realtimeModel: REALTIME_MODEL,
    env: {
      OPENAI_API_KEY: openaiPresent ? 'present' : 'missing',
    },
    routes: {
      abuaiChat: 'configured',
      abuaiOnline: 'configured',
      // Transcription is currently client-direct Groq (VITE_GROQ_API_KEY).
      // The client diagnostic panel checks this separately.
      voiceTranscribe: 'client_direct_groq',
    },
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
