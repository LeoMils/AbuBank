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
const BUILD_VERSION = '0.96.0-next-weekday'
const BUILD_LABEL = 'AbuBank — NEXT_WEEKDAY (Intelligence Parity Cycle 17, text-only via the real ExecutiveCognitiveController): a widened probe surfaced that איזה תאריך יום שלישי הבא matched date_query and returned TODAY (confidently wrong) and מתי יום ראשון הבא fell to the LLM. dateReasoner handled relative words + N-day/hour arithmetic but not יום <weekday> הבא. Added nextWeekdayAnswer (next occurrence of a weekday strictly after today; if today IS that weekday, next weeks) + NEXT_WEEKDAY_QUERY_RE routing that requires a date-asking frame (מתי/איזה תאריך/איזה יום) so a create (תקבעי פגישה ביום שלישי הבא) is NOT hijacked. Fixed a latent bug: the routing regex used an ASCII word-boundary anchor after a Hebrew frame (which never matches there), so the מתי forms had silently fallen to the LLM. now Wed 2026-07-15: מתי יום ראשון הבא → 19 ביולי, איזה תאריך יום שלישי הבא → 21 ביולי, מתי שבת הבאה → 18 ביולי. Evidence: nextWeekday.test.ts 5/5 green (CODE); date + calendar regression suites 117 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.95.0.'

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
