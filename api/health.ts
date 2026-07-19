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
const BUILD_VERSION = '0.130.0-calendar-search-day'
const BUILD_LABEL = 'AbuBank — CALENDAR_SEARCH_DAY (Cycle 50 — Leo full stale-round export replayed + locked). Ran Leo 20-turn stale-round export through the importer against the CURRENT build. Most turns were already fixed 0.79→0.129 (family brothers deterministic, relation-phrase create → עדי, in-law chain). The CATASTROPHE ROOT still reproduced and is NOW FIXED (RED-first): the calendar SEARCH path. Martita asked WHICH DAY her meeting was and got only the hour, repeatedly. calendarSearchReasoner grabbed only the first word after עם ("החתן") and never resolved the relation phrase, so after the create correctly resolved to גלעד the search could not even FIND the event she just made ("אין לך פגישה עם החתן"); and formatEventNatural emitted no day/date (emoji+title+hour only). Fix (cognitiveRuntime.ts calendarSearchReasoner): capture the WHOLE person phrase after עם/אצל, resolve it via resolvePersonPhrase (החתן של רפי → גלעד), search resolved-then-raw-then-first-word, and answer DAY + DATE + TIME via safeHebrewDate (פגישה עם גלעד ביום שני, 20 ביולי 2026 בשעה 21:00). Locked EVERY stale-round turn as permanent regressions incl. a full 20-turn crash-free/finalized/no-fabricated-contradiction replay (leoStaleRoundRegression.test, 8/8). Note: "אח של נועה" stays literal because נועה is not in the family graph (correct — no fabrication). Evidence: CODE — leoStaleRoundRegression 8/8, calendar/parity suites green, full suite + typecheck + build. Builds on 0.129.0.'

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
