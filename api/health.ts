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
const BUILD_VERSION = '0.142.0-understanding-first-layer'
const BUILD_LABEL = 'AbuBank — UNDERSTANDING_FIRST_LAYER (INTAKE REBUILD, session 3 · P1 foundation). Built the understanding-first intake layer (src/screens/AbuAI/understandingIntake.ts): a STRICT StructuredIntent schema {operation, personRefs (relation phrases in any morphology OR names), dateWords, timeWords, place, title, fact{kind,value}, correction, confirmation, ambiguousQuestion}, an interpret() step with an INJECTED transport (LLM half — MOCK-provable; real provider call + latency is PREVIEW-class, deliberately unproven), and groundIntent() — the PURE deterministic half that grounds an intent through the EXISTING engines: person refs resolve via the ONE seam ("החתן של מור"→גלעד), date/time via the date engine ("מחר"/"בשלוש אחר הצהריים"→date+15:00), nothing invented (a dog ref stays in unresolvedRefs; an unparseable date stays null). normalizeIntent() coerces arbitrary/malformed model JSON to a safe shape (bad op→unknown) so the caller always falls back cleanly. Evidence: CODE/MOCK — understandingIntake 13/13 + FULL suite 11488 pass / 2 todo / 0 regressions, typecheck + build. HONEST LIMIT: this layer is test-covered but NOT yet wired as the live gate in the async turn path (a separate careful step); patterns remain the fast-path cache. NOT device-proven; only the Leo free-language round decides readiness. NEXT: wire P1 live (async, real-latency PREVIEW) + P3–P8. Builds on 0.141.0.'

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
