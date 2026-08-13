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
const BUILD_VERSION = '0.220.0-companion-brain-portrait'
const BUILD_LABEL = 'AbuBank 0.220.0 — THE COMPANION BRAIN (Phase 3): Abu now HOLDS her family in her head instead of looking them up. The insight: retrieval made her a clerk who truthfully announces she is about to check. The old 10,000-char instructions cap was a MISDIAGNOSIS — measured against the real provider, session.instructions accepts AT LEAST 200,000 chars (the device crash was the 1024-char transcription prompt, never instructions). So a warm PROSE portrait of everyone durable now lives in the instructions, GENERATED from the data files (familyPortrait.ts): the closest circle in full warmth, the extended family and the Papi side a line each, the friends (so who-are-my-friends finally has a warm answer), the life history as story, and the shape of what is unknown. Adding a person stays a data-only edit — proven by a test that adds a person and finds them in the assembled context. people_lookup stays but only to REACH someone for an action or to double-check; the model no longer looks up who family is. Cap raised 10,000 to 60,000 (about 3x the real ~21k assembled size, far under the 200k limit). Verified: the real provider accepts the full Companion-Brain session payload (instructions 21,393 chars) with HTTP 200. Evidence: CODE + AUTOMATED TEST + PREVIEW (real-API 200); typecheck + full suite (12,640) + build. Prior in this branch: FIX 1/2/4/7/5/3 (v0.215-0.219). Next: P4 relationships + lists, P5 friend behaviour, P6 actions, P7 online depth, P8 reliability, P9 companion suite.'

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
