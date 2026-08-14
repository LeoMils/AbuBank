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
const BUILD_VERSION = '0.237.0-cost-controls'
const BUILD_LABEL = 'AbuBank 0.237.0 — COST, the first real number (Item 2). New aiCostModel.ts (real OpenAI Realtime per-minute rates) prices a representative 20-min companion session: BEFORE the O-LIFECYCLE idle-stop the mic streamed the whole call = ~$2.26/₪8.34; AFTER = ~$1.45/₪5.37 — a 35.7% saving, and ONLY idle mic-input minutes are cut (Abu audio output + text are byte-identical, so conversational quality cannot drop — asserted by test). Quality bugs (stalls forcing repeats, repeated formulations) cost ~$0.24/₪0.90 per session on top. New costMeter.ts: a persisted session/day/month counter, a 70%-of-ceiling alert to Leo (once per tier, via the existing sendNotification sink), and at the ceiling a GRACEFUL DEGRADE (cheaper gpt-4o-mini-realtime + shorter replies) that NEVER disconnects Martita and NEVER tells her — the deliberate fix to the old spend guard that cut her off. Mutant cost-ceiling-disconnects-instead-of-degrades KILLED. Headline numbers pinned by tests. Live wiring into WebRTC response.done + mid-session model swap is documented, not rushed (device-class voice path). Evidence: cost tests green + full suite + build. Prior: one voice engine (v0.236).'

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
