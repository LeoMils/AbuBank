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
const BUILD_VERSION = '0.100.0-backward-date'
const BUILD_LABEL = 'AbuBank — BACKWARD_DATE (Intelligence Parity Cycle 21, text-only via the real ExecutiveCognitiveController): wide-probe gap — איזה יום היה לפני שבוע fell to the LLM. dateReasoner did FORWARD arithmetic (בעוד N ימים/שבוע) but not BACKWARD. Added lifneiDaysOffset (לפני N ימים/יומיים/שבוע/שבועיים/N שבועות → a backward day offset) + extended RELATIVE_DATE_QUERY_RE to route לפני questions to date_query. now Wed 2026-07-15: איזה יום היה לפני שבוע → יום רביעי, 8 ביולי; לפני יומיים → יום שני, 13 ביולי; לפני 3 ימים → 12 ביולי. Forward בעוד arithmetic is unchanged. Evidence: backwardDate.test.ts 5/5 green (CODE); date regression suites 122 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.99.0. (0.100 continues the 0.x foundation sequence — not a 1.0 GA.)'

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
