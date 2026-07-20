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
const BUILD_VERSION = '0.151.0-fail-closed-understanding'
const BUILD_LABEL = 'AbuBank — FAIL_CLOSED_UNDERSTANDING (INTAKE REBUILD, session 12 · standing obligation #9). The understanding layer now FAILS CLOSED under every degenerate interpreter outcome and NEVER fabricates a structured action. interpretUtterance got a bounded timeout (a hanging provider → operation:unknown, never blocks a turn); malformed/partial-schema/provider-down/unsupported-op all coerce to a safe unknown shape. Added decideIntakeAction — the explicit policy that, given a grounded intent, returns act / clarify (ONE question) / decline: it never acts on empty or contradictory meaning (a "create" with nothing concrete → asks; a family query with an unresolvable person → asks; ambiguity flagged by the model → asks its one question; unknown/chat → declines to the normal path). Evidence: CODE — understandingFailClosed 10/10 (incl. a fake-timer timeout) + FULL suite 11562 pass / 2 todo / 0 regressions, typecheck + build. decideIntakeAction is the proven policy for action-routing (test-covered); wiring it to DRIVE actions is the deeper P1 integration, next. NOT device-proven; only the Leo free-language round decides ready. NEXT: latency stage KPIs (#8), shadow over create/ledger paths, meaning-cache (#10), transcript→gold pipeline (#11), paraphrase/multilingual tolerance (#4). Builds on 0.150.0.'

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
