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
const BUILD_VERSION = '0.255.0-classified-monitor'
const BUILD_LABEL = 'AbuBank 0.255.0 — M2 classified checks (heuristic, FP-measured, gated OFF). Three intent-level defects now have detectors: DISTRESS_MENU (distress answered with a capability menu, not warmth + one action), METHOD_NARRATION (narrating its own lookup/method), UNGROUNDED_ENTITY (asserting a person-fact when no grounding tool returned this turn — the Gilad-class risk). classifiedCorpus GENERATES 82 model-free cases (40 engineered defects + 42 warm-correct built to be MISTAKEN for a defect; nothing verbatim from classifiedMonitor.ts). MEASURED: DISTRESS_MENU 30/30, METHOD_NARRATION 6/6, UNGROUNDED_ENTITY 4/4 = 100% interception, 0 FALSE POSITIVES over 42 clean cases; detector latency p95 0.0014ms. Wired into liveSession as OBSERVATION (always emits/logs, cannot block output) with per-turn grounded-tool tracking; the one-attempt classified REPAIR (buildClassifiedRepair) is DOUBLY gated OFF (LIVE_CLASSIFIED_MONITOR && LIVE_OUTPUT_MONITOR_REPAIR) — repair round-trip latency + warmth off/on are DEVICE-gated (API spend), not claimed. Fixed a real latent bug: JS word-boundary anchors are ASCII-only, so a word boundary next to a Hebrew letter never matched. Report: docs/eval/MONITOR_CLASSIFIED_REPORT.md. Prior: lookup cue (v0.254).'

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
