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
const BUILD_VERSION = '0.184.0-live-harness-fixes-rc1'
const BUILD_LABEL = 'AbuBank 0.184.0 — LIVE_HARNESS_FIXES_RC1: acted on the text-harness findings. GROUP 1 (stalling): removed the seeded "רגע, בודקת" filler from BOTH the instruction frame (now "# Before a Tool Call": call the tool first, speak only the grounded result, any ack rides with the tool call) AND abu-persona.md. GROUP 2 (over-claim): calendar rules now forbid save-verbs (קבעתי/שמרתי/נקבע) until confirm_calendar_event returns saved:true, and require calling confirm on approval. GROUP 4 (name): abu-persona.md reconciled — Abu uses the name Martita naturally at least once in a long exchange, warm/varied/non-repetitive. Two harness assertion bugs fixed: MASC_SELF drops gender-homographic verbs (רואה/רוצה); the save-claim check is now negation-aware ("לא קבעתי"). Added 3 location-survival scenarios (create+confirm+readback, correct-time-keeps-location, update-location) that expose the device "location dropped on save" bug (LiveEvent gains an optional location the commit path still does not persist). Scenarios 40→43. Evidence: CODE (typecheck 0; harness/instructions tests green) + a real gpt-4o-mini harness run. PHYSICAL_DEVICE NOT claimed.'

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
