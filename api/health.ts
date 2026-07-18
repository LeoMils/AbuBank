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
const BUILD_VERSION = '0.124.0-flight-recorder-import'
const BUILD_LABEL = 'AbuBank — FLIGHT_RECORDER_IMPORT (Cycle 44 — Priority 1: real conversations become permanent tests). Discovery-first: the CAPTURE side already exists and is REUSED not rebuilt — observeTurn (OBSERVE_ONLY) is wired INSIDE ExecutiveCognitiveController so both typed and voice are captured on the one runtime path; buildEnvelope redacts + minimizes (text-only, no audio, PII stripped, dedup); the durable IndexedDB evidence queue is the local store; the off switch is VITE_EVOLUTION_KILL / EvolutionConfig.enabled. The missing link, now built (src/eval/flightRecorderImport.ts): an IMPORTER that turns an exported transcript into a STANDING regression replay. envelopesToExport maps redacted envelopes to a stable text-only JSON (serializeExport/parseExport round-trip, asserted to carry no audio field); importLeoRepro converts docs/eval/LEO_DEVICE_FAILURES_REPRO.json into replay sessions with per-turn expectations derived from the STRUCTURED truth fields (resolvedToGilad, hasLocation, dateTomorrow, verbatimDump) not the stale recorded wording; replayExport runs every recorded turn back through the SAME app entry the marathon/scorecard use and asserts each recorded truth (expectContains/expectAbsent/expectSide) still holds — and CATCHES divergence (a probe asserting a false expectation is reported as a failure, proving no green-washing). Leo 3 real device transcripts now replay green as permanent tests. RED-first: the standing suite was written before the module existed. Evidence: CODE — flightRecorderImport 3/3, evolution + recorded-replay 71/71; full suite + typecheck + build. Voice/Realtime behavior untouched. PREVIEW/PHYSICAL not claimed. Docs: docs/eval/FLIGHT_RECORDER.md. Next: user-facing export button + off-switch toggle wiring. Builds on 0.123.0.'

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
