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
const BUILD_VERSION = '0.250.0-output-monitor'
const BUILD_LABEL = 'AbuBank 0.250.0 — M2 output monitor (deterministic). The realtime audio path streams speech directly, so there is no pre-delivery interception point (BRIEF_AUDIT); the design is a POST-TURN monitor + one-attempt next-turn repair. Deterministic detectors (zero false-positive): language script purity, response length, a named source/URL, reading back on-screen text, and literal count (asked 1-5, counted 0-5). monitorTurn runs after every live turn as OBSERVATION (logged; onMonitorViolations callback) with ~0ms added latency and no change to output. A HARD violation (wrong language, named source, wrong count) stashes ONE corrective redo fired on response.done when the wire is free, gated behind LIVE_OUTPUT_MONITOR_REPAIR (default OFF) — pending device measurement, since the audio already played and a redo is an audible self-correction. MEASURED: outputMonitor.test 9 (each detector fires on the real device defect, silent on a good answer); interception on the instrument 0/5 real turns (the root-cause fixes already produce clean output — the monitor is the standing net + the interception-rate signal). Classified checks (distress-to-menu, method narration, invented entity) are deferred until their false-positive rate is measured. Gates: typecheck 0, full suite 12,781 passed, build ok. Prior: online relevance + synthesis (v0.249).'

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
