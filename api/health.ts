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
const BUILD_VERSION = '0.152.0-per-turn-shadow'
const BUILD_LABEL = 'AbuBank — PER_TURN_SHADOW (INTAKE REBUILD, session 13 · standing obligations #2/#6/#7/#8). Shadow validation now covers the WHOLE understanding path, not only the family seam. understandingShadow.ts compares, PER TURN, the legacy pattern intake (observeOldIntake on the real runCognitiveTurn — family turns resolve the REAL legacy people via the live seam) against the understanding path (interpret to groundIntent to decideIntakeAction), classifying each turn into agree / recovered / regressed / disagree / clarify / false_clarify / unresolved. It is wired LIVE observation-only in runtimeFullTurn (onIntakeShadow, fire-and-forget so it adds ZERO latency to the answer; a pattern MISS reuses its interpretation via shadowPre so NO turn fires a second provider call) and in fullTurnBridge via intakeShadowCollector (bounded ring buffer, rolling KPI log, immediate disagree/regressed risk surfacing). aggregateKPIs reports understanding RATES not test counts (agreement, semantic recovery, disagreement, regression, ambiguity, false-clarify, unresolved) and pctl reports latency p50/p95/worst per stage (interpret/ground/decide/total). The KPI corpus test publishes docs/eval/UNDERSTANDING_SHADOW_KPI.md and asserts the migration-safety gate: regressed=0 and disagree=0 (understanding never loses or contradicts the engines), recovery>0, ambiguity>0. It also surfaced a real finding: on under-specified turns the legacy path acts while understanding asks one question — the safer behavior, a migration candidate. Evidence: CODE — understandingShadow 13/13, shadow-wiring 2/2, KPI corpus 1/1, typecheck + full suite. The MOCK interpreter encodes target behavior; live real-provider rates + interpret latency are PREVIEW-pending. NOT device-proven; only the Leo free-language round decides ready. NEXT: system-level whole-conversation proof (#1), paraphrase/multilingual tolerance (#4), meaning-cache (#10), transcript-to-gold pipeline (#11). Builds on 0.151.0.'

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
