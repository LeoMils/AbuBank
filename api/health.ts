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
const BUILD_VERSION = '0.121.0-parity-scorecard'
const BUILD_LABEL = 'AbuBank — PARITY_SCORECARD (Cycle 41 — Priority 2, deterministic half): built the PARITY SCORECARD — a standing, repeatable measure of the ACTUAL AbuAI app-path reply on the 6 mandate dimensions (correctness · warmth · brevity · answered-what-was-asked · language discipline · naturalness) over a curated He+Es real-capability turn set, run through the SAME app entry as the marathon. It REUSES the existing judges (conversationQualityJudge.judgeTurn + judgeRunner.judgeResponse) — no parallel judge — plus engine-computed oracles, and exposes a PLUGGABLE reference/judge seam for a future LIVE ChatGPT-class run (honestly labelled deterministic, NOT live-model, since this env mocks the LLM). On its FIRST run it caught a real language-discipline bug: a Rioplatense "cancelalo" deleted correctly but confirmed in HEBREW (detectLang is conservative; deleteReasoner emitted its Hebrew title). Fixed: deleteReasoner self-detects a Rioplatense delete command and confirms in Spanish via personName. Scorecard now 6/6 dimensions at 100% (11 scored turns). Evidence (CODE at app-entry level): parityScorecard + generativeMarathon 1200/1200 clean; full suite green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.120.0.'

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
