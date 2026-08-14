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
const BUILD_VERSION = '0.249.0-online-relevance'
const BUILD_LABEL = 'AbuBank 0.249.0 — M4 online: relevance gate + synthesis. Two device defects: (1) the hadAnswer gate checked for ANY currency token, so a store pricing a hundred perfumes passed a Chanel question and returned Clive Christian / Fugazzi prices; (2) the tool handed the realtime model a RAW page dump (cart text, filter counts, marketing copy). Fix (1) RELEVANCE: firstWins requires a price token NEAR a discriminating product term from the query (priceNearProduct) — a page pricing something else is a MISS. Fix (2) SYNTHESIS: synthesizeAnswer sends the fetched text + the original query to a cheap model and returns ONE clean sentence about the QUERIED product, or no_answer — never a raw dump, never a different product; wired into firstWinsOnlineFetch (eval) and api/abuai-online (device, behind ONLINE_DEEP_FETCH). MEASURED on the real gpt-realtime instrument: three differently-phrased Bleu de Chanel questions all returned a real price in a consistent range (597-649 shekels), each one clean sentence; ttft 3.0-4.2s. STILL TODO in M4: prefetch warm store + non-verbal cue. Gates: typecheck 0, full suite 12,772 passed, build ok. Prior: input oracle (v0.248).'

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
