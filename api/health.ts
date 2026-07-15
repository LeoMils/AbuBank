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
const BUILD_VERSION = '0.88.0-relative-date-time-arithmetic'
const BUILD_LABEL = 'AbuBank — RELATIVE_DATE_TIME_ARITHMETIC (Intelligence Parity Cycle 9, text-only via the real ExecutiveCognitiveController): an expanded probe (intelligenceGapProbe2) surfaced that dateReasoner handled fixed offset WORDS (אתמול/מחר/שלשום/מחרתיים) but not ARITHMETIC — בעוד שלושה ימים returned TODAY (confidently wrong), בעוד שבוע fell to the LLM, and מה השעה בעוד שעתיים returned the current time (10:00, not 12:00). Added beodDaysOffset (בעוד N ימים/יומיים/שבוע/שבועיים/N שבועות → forward date) + beodHoursOffset (בעוד N שעות/שעה/שעתיים → clock + N hours), both deterministic from ctx.now, and extended RELATIVE_DATE_QUERY_RE to route בעוד questions to date_query. Evidence: relativeDateArithmetic.test.ts 6/6 green (CODE); date regression suites 31 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.87.0.'

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
