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
const BUILD_VERSION = '0.129.0-day-and-stale-guard'
const BUILD_LABEL = 'AbuBank — DAY_AND_STALE_GUARD (Cycle 49 — triage of Leo stale-round failures + stale-build guard). Leo verification round ran on a 49-versions-stale cached build (0.79.0), not 0.128. Imported the observed turns as PERMANENT regressions (leoStaleRoundRegression.test) after replaying against the CURRENT app entry. TRIAGE: already fixed 0.79→0.128 — family contradiction (עדי/נועם answer as BROTHERS deterministically, no invented בן דוד), relation-phrase create (אח של נועם → עדי), in-law chain (מה הקשר בין ירדן לנועם → via עילי). STILL reproduced + NOW FIXED (RED-first): calendar which-day/when. A saved meeting queried באיזה יום / מתי הפגישה returned only the hour, a location dead-end, or the LLM. Root: CAL_PROPERTY_RE + CAL_PROP_CUE did not match באיזה יום / מתי הפגישה, and answerCalendarProperty had no day branch (מתי gave date without the weekday). Fix (cognitiveRuntime.ts): route those turns to the property path and answer DAY + DATE + TIME via safeHebrewDate (ביום שני, 20 ביולי 2026 בשעה 15:00); a pure hour question still answers the hour. STALE-BUILD GUARD: services/versionSync existed but was wired NOWHERE (dead code) — mounted it as a calm StaleBuildBanner in App that fetches /api/health and, on a version mismatch with this bundle, offers a one-tap refresh; typed-script gained Step 0 (verify the QA badge = expected version, else STOP). Evidence: CODE — leoStaleRoundRegression 5/5, StaleBuildBanner 3/3, full suite + typecheck + build. Builds on 0.128.0.'

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
