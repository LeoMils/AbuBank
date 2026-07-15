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
const BUILD_VERSION = '0.94.0-civic-holiday-online'
const BUILD_LABEL = 'AbuBank — CIVIC_HOLIDAY_ONLINE (Intelligence Parity Cycle 15, text-only via the real ExecutiveCognitiveController): device failure — wrong Independence Day (gave 2024, then a past date). National/civic days (יום העצמאות/חג העצמאות, יום הזיכרון, יום השואה, יום ירושלים, Spanish día de la independencia) are NOT in the deterministic religious-holiday table and their Gregorian date is nidche-adjusted (postponement rules), so answering from model memory or a table would risk inventing a wrong date. Worse, באיזה תאריך יום העצמאות matched date_query and returned TODAY (confidently wrong), and מתי חג העצמאות / the Spanish form fell to the LLM. Added CIVIC_HOLIDAY_RE and routed these to LIVE retrieval BEFORE date_query and before the LLM fallback — never a hallucinated/past date; the deterministic religious holidays (ראש השנה/פסח) and relative dates (אתמול) are NOT hijacked. Evidence: civicHolidayOnline.test.ts 7/7 green (CODE); date + online regression suites 70 green; full suite green. NOTE: the exact returned date is the LIVE provider (PREVIEW-class); deterministic nidche computation intentionally NOT hardcoded to avoid inventing dates. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.93.0.'

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
