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
const BUILD_VERSION = '0.271.0-earonly'
const BUILD_LABEL = 'AbuBank 0.271.0 — LOUD-NOT-SILENT hardening (overnight). (1) DIAGNOSIS: the realtime transport is NOT broken — proven against the real account tonight: the ephemeral MINT returns 200 (free) so the session OPENS, then the first inference returns insufficient_quota/credit_balance_exhausted. Three prior sessions spent ~$0 because the OpenAI PROJECT HAS NO CREDIT, not a transport/auth/endpoint/version bug. Add credits at platform.openai.com to unblock Layer-3. (2) CODE FIX: the realtime error handler now recognises credit exhaustion explicitly — plain-Hebrew fallback to Martita (never raw English), a distinct REALTIME_CREDIT_EXHAUSTED flight stage + loud operator log, pipeline fallback with no retry loop (realtimeCreditExhaustion.test). (3) FLAG PROMOTION LEDGER: src/services/deviceGatedFlags.ts + a boot assertion in main.tsx HARD-FAIL if a device-gated flag (audio-tune/barge-in/prefetch) was ear-confirmed but still ships OFF — the ONLINE_DEEP_FETCH silent-drop hazard is now machine-caught, not a comment. Layer-3 real-model run stays BLOCKED on account credit. Do NOT merge (production serves Aug 5). Prior: EAR-ONLY (v0.270).'

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
