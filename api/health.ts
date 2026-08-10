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
const BUILD_VERSION = '0.188.0-live-flight-recorder-rc1'
const BUILD_LABEL = 'AbuBank 0.188.0 — LIVE_FLIGHT_RECORDER_RC1 (Part C): observability + turn-health on the live path, a calendar-window read, and a family-source reconciliation guard. (C.1) read_calendar now takes an optional from..to date RANGE — "this week"/"this month" return EVERY event in the window (string YYYY-MM-DD compare, no timezone math), not just one day. (C.2/C.3) New PURE FlightRecorder (liveTrace.ts): records MY speech, HER speech, and every tool call with args+result; flags SILENT TURNS (a turn ending after a tool call with no spoken continuation) and records TRUNCATION EVIDENCE (mic opens while Abu is still speaking — the VAD-interrupt/self-hearing cause of "only the first word heard"). Observation only — no VAD/turn/audio behaviour changed; an operator-facing "תיעוד ⤓" button downloads the whole-session trace. (C.4) familyReconciliation guard: proves canonical spellings (אדר/איילון canonical; הדר/אילון only as aliases), every family_data.json person RESOLVES, Abu is instructed never to GUESS a relationship, and reports drift between family_data.json and abu-family.md — report only, never rewrites data. New aliases in family_data.json (הדר→אדר, אנבל→Anabel, איליי→Eili, מרתה→Martita) with grounded-answer coverage. RECOVERY: a machine shutdown had interrupted generate:knowledge, blanking 16/21 per-person YAMLs; regenerated from the intact family_data.json — validate:knowledge + validate:family green. Evidence: CODE + AUTOMATED TEST (Part C tests green; typecheck 0; build 0). On-device trace/audibility are PHYSICAL_DEVICE — NOT claimed.'

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
