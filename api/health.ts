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
const BUILD_VERSION = '0.125.0-flight-recorder-ui'
const BUILD_LABEL = 'AbuBank — FLIGHT_RECORDER_UI (Cycle 45 — Priority 1 tail: user-facing export + off switch). Settings now has a Flight Recorder control (About/diagnostics area): a senior-first OFF SWITCH toggle for local conversation capture and an EXPORT button that downloads the redacted, text-only transcript. Clean architecture: the pure export shape + serializers moved to a RUNTIME module (src/evolution/recorderExport.ts — envelopesToExport / serializeExport / parseExport / exportStoredTranscript reads the durable evidence queue) so the app bundle never pulls the eval/replay harness; src/eval/flightRecorderImport.ts re-exports them so the shape has ONE source. The off switch (src/evolution/recorderSwitch.ts) persists in localStorage and is read PER-TURN at the single serving seam (observeTurn) so toggling takes effect immediately and can only make capture SAFER (never escalate) — consistent with the Evolution Central Law. RED-first: recorderSwitch.test proved observeTurn kept capturing when off BEFORE the guard was added, then green. Evidence: CODE — recorderSwitch 3/3, recorderExport 3/3, flightRecorderControls 3/3, flightRecorderImport 3/3; full suite + typecheck + build. Voice/Realtime behavior untouched. PREVIEW = deploy + health only. Docs: docs/eval/FLIGHT_RECORDER.md. Builds on 0.124.0.'

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
