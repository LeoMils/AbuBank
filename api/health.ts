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
const BUILD_VERSION = '0.143.0-understanding-wired-live'
const BUILD_LABEL = 'AbuBank — UNDERSTANDING_WIRED_LIVE (INTAKE REBUILD, session 4 · P1 live). Wired the understanding-first layer into the async turn path: on a pattern MISS (runtimeFullTurn `needsLLM` branch — patterns stay the fast-path cache), it now interpret()s the turn via a REAL transport (makeInterpretTransport → sendServerChat → /api/abuai-chat, strict json_schema), groundIntent()s it through the deterministic engines, and enriches the LLM grounding with VERIFIED facts (graph-resolved people, engine-parsed date/time) so the model cannot hallucinate them. Understanding never decides a family relation and can never invent a person (unresolved refs are dropped); a failed interpret never breaks a turn; latency is reported ([AbuAI][UNDERSTAND|LATENCY], onUnderstandLatency). Evidence: CODE/MOCK — understandingIntake 19/19 + live-wiring 3/3 (mock transport enriches grounding + latency reported + backward-compatible when absent) + FULL suite 11496 pass / 2 todo / 0 regressions, typecheck + build. PREVIEW/PENDING: the REAL provider call + on-device latency are proven only on a deploy — NOT yet. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P3 garble suite → P4–P8 → verification regime. Builds on 0.142.0.'

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
