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
const BUILD_VERSION = '0.290.0-earonly'
const BUILD_LABEL = 'AbuBank 0.290.0 — MONSTER QA HARDENING (supersedes 0.289.0). RUNTIME: (A7) billable-proxy cost caps — TTS input ≤2000 chars, STT audio ≤20MB, chat body ≤200KB / ≤60 messages / max_tokens ≤4096, rejected before the provider call (no user auth on this PWA → bounded per-request limits; auth/rate-limit = owner decision). (A8) createAppointmentSafe is IDEMPOTENT — a duplicated/retried tool-result for a TRUE full-content duplicate returns the existing event. Prior RUNTIME: (A6) retrieved web content is UNTRUSTED DATA — retrievalGuard neutralizes injection directives (override-instructions / reveal-secret / tool-call / recipient-exfil / forged-authority) BEFORE online synthesis; the online path executes nothing from content. QA machinery (not shipped runtime): (A2) deployed-secret scanner REPAIRED + calibrated — explicit target, fail-closed, chunk-graph, credential-material; (B1) canonical qa:monster orchestrator. Priors (still shipped): Yarden spouse-of-descendant CLASS fix (corpus north-star=0); 13 red voice/STT tests resolved to server-only arch; TEMPORAL=GROUNDED+FRESH weather/FX dated + dated-search for latest-result; tool-sequencing RAW-EVENT oracle; replacement-path proofs. Do NOT merge (production serves an older build; 3 old keys await owner revocation).'

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
