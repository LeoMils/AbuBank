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
const BUILD_VERSION = '0.122.0-parity-live-crosscheck'
const BUILD_LABEL = 'AbuBank — PARITY_LIVE_CROSSCHECK (Cycle 42 — Priority 2, the live seam): implemented the pluggable LIVE reference/judge as a CROSS-CHECK panel (user choice): the reference reply is taken from BOTH a Claude model (claude-opus-4-8) and an OpenAI GPT model under the same warm-elderly-companion persona brief, and each AbuAI reply is scored by a judge panel — AND across judges (a dimension passes only if every judge agrees AbuAI matched the reference), then OR across references (compared against the stronger of the two). No new dependencies: raw fetch, so package.json is untouched (a human-approval gate). Anthropic calls follow the claude-api contract (claude-opus-4-8, output_config.effort high, structured-output judge schema). The KEYED run is OUT-OF-BAND (needs ANTHROPIC_API_KEY + OPENAI_API_KEY; a keyed run is PREVIEW/PRODUCTION evidence) — the request wiring and the cross-check aggregation are proven deterministically with mocked fetch (parityLiveJudge.test.ts 7/7, CODE). Deterministic scorecard remains 6/6 dimensions at 100% (17 scored turns). Evidence: parityLiveJudge 7/7 + parityScorecard + generativeMarathon 1200/1200 clean; full suite green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.121.0.'

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
