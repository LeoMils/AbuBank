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
const BUILD_VERSION = '0.185.0-live-calendar-location-fix-rc1'
const BUILD_LABEL = 'AbuBank 0.185.0 — LIVE_CALENDAR_LOCATION_FIX_RC1: fixed the LOCATION_DROPPED bug the harness proved, end to end. LiveEvent now carries location+notes; LiveTools commit passes every prepared field to the store; durableCalendarStore persists location/notes and read_calendar reads them back — nothing the model prepared is dropped on save. New real tool update_calendar_event edits an ALREADY-SAVED event IN PLACE by date (no duplicate), reusing AbuCalendar updateAppointment; instructions route committed-event edits to it, not prepare. Every draft field (title/date/time/participant/location/notes) round-trips create→confirm→persist→read→update, proven by an exhaustive deterministic liveTools test. bait over-offer fixed: instructions make Abu decline capabilities with no tool (taxi/email/reminder/…); the capability check is decline-aware. Stalling check is now Hebrew word-boundary aware (no more false positive on "רגע" inside "להירגע"). Six clarifying-question scenario LABELS corrected (asking "which doctor?" is right). Harness (gpt-4o-mini): 33→41/43 PASS; all 3 location + 3 bait scenarios GREEN. Evidence: CODE (typecheck 0; 63 harness/liveTools tests green) + a real gpt-4o-mini run. PHYSICAL_DEVICE NOT claimed.'

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
