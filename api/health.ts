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
const BUILD_VERSION = '0.223.0-companion-quality-suite'
const BUILD_LABEL = 'AbuBank 0.223.0 — P9: the companion quality suite, the only honest measure of whether the Companion Brain worked. It runs 9 companion scenarios against the REAL model through the EXACT live instructions + tools + executor (the same runner the harness uses), and scores Abu on companion qualities from her actual Hebrew output and tool calls: identifies a person by name and relationship, describes an in-law path instead of denying a relationship, lists the friend circle, knows a friend story, recalls the history (Mendoza, the store), says she does not know warmly without inventing, never offers red wine, never announces a check before a tool, and handles distress (prepares help, never claims a call). Key-gated and infra-safe: with no key, or when the model is unavailable, it reports BLOCKED and never fakes a pass and never fails the build — the pass-rate floor is asserted only when the model actually produced output. Tonight the measurement is BLOCKED: the OPENAI_API_KEY has no credits (HTTP 429 no credits remaining), so I could not get a real pass rate — the suite is built and green and will print the rate the moment the key is funded (npx vitest run companionSuite.test.ts). Evidence: CODE + AUTOMATED TEST (the suite itself); the companion pass rate is PENDING on a funded key. typecheck + full suite (12,661) + build. Prior: Companion Brain P0-P3 (v0.220), P5 behaviour+safety (v0.221), P8 name matching (v0.222). Remaining: run P9 once funded; P7 online depth; P6 actions polish; P8 429-backoff/audio/one-voice-engine.'

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
