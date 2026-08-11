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
const BUILD_VERSION = '0.193.0-abu-news-grounded-rc1'
const BUILD_LABEL = 'AbuBank 0.193.0 — ABU_NEWS_GROUNDED_RC1 (Part 3): Abu News is a real, grounded news app. New edge endpoint /api/abuai-news (server-side key, OpenAI Responses web_search) returns Israel-primary Hebrew stories as STRUCTURED JSON — each requiring a headline + plain-Hebrew summary + source + real url + time. A GROUNDING GATE (web_search must cite ≥1 source) plus a per-story completeness guard mean nothing half-blank, stale or fabricated is ever shown; on any failure the screen says so honestly and shows NO stories. The client (newsClient) re-validates the wire and caches the SAME grounded results so Abu can later speak from them (live wiring is the next commit). Screen is senior-first: large type, high contrast, source+time on every card, honest failure + retry, dynamic story count. Evidence: CODE + AUTOMATED TEST (endpoint grounding/honest-failure, client validation+cache, completeness guard — 20 tests; full suite green; typecheck 0; build 0). REAL PROBE (key reachable via the shared loader — NOT blocked): the provider retrieves and cites (7 url_citations observed), but reliable per-story structured extraction still needs prompt tuning — meanwhile the endpoint correctly returns an HONEST NEWS_NO_RESULTS rather than fabricating. Real on-screen stories are PROVIDER/PREVIEW — NOT yet claimed.'

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
