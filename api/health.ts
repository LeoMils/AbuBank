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
const BUILD_VERSION = '0.119.0-marathon-wide'
const BUILD_LABEL = 'AbuBank — MARATHON_WIDE (Cycle 39 — widen the generative marathon to 1200 sessions × 8 scenario classes): added relation-phrase creates ("פגישה עם ה<rel> של <person>" saves the RESOLVED person), "the last one" referable-cancel chains, mid-flow person corrections, and Spanish (Rioplatense) calendar sessions. The wide batch surfaced 4 break classes; fixed 3 general mechanisms: (1) ES REFERABLE DELETE — "cancelalo/borrá/eliminala" on a SAVED event dead-ended to the LLM (Hebrew-only referential-delete gate); added a Rioplatense mirror so it routes to the deterministic delete. (2) FOCUS-PROPERTY PRECISION — "איפה אני פוגשת אותו?" answered from the OLDEST same-person event; now takes the most-recently-created match (the referent just set up), so an older no-location meeting no longer shadows the fresh one. (3) PERSON-NAME TRUNCATION — extractPerson bare ב/ל/על prefix-stop truncated any name starting with ל/ב (לאו, לאה, לירון) and the genitive target after "של"; split hard-stops from the prefix-stop and exempted the first person word + post-"של" targets. Evidence (CODE at app-entry level): generativeMarathon 1200/1200 clean; full suite green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.118.0.'

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
