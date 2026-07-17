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
const BUILD_VERSION = '0.118.0-marathon-p4'
const BUILD_LABEL = 'AbuBank — MARATHON_P4 (Reality-driven — P4 generative marathon): built the generative marathon — a seeded generator composing multi-turn sessions (family who × calendar CRUD with pronoun referability × date arithmetic × memory store/recall/forget) driven through the REAL app entry (index.tsx-faithful guarded pronoun/follow-up preprocessing + ExecutiveCognitiveController, mocked llm/online). The first batch found breaks in 2 general classes, both LAB-vs-APP divergences (P0): (1) DATE ROUTING — the date engine handles "בעוד N ימים" but classifyIntent only routed the "איזה יום … בעוד" ordering, not "בעוד … איזה יום" → LLM; fixed RELATIVE_DATE_QUERY_RE to accept both orderings. (2) DIALOGUE GUARD — a repeated FACTUAL answer (two questions sharing "מור", or two dates on the same day) was suppressed as a loop; now only STUCK/non-answer repeats escalate (fixed the truth in the test that encoded the bug). A 400-session batch now passes CLEAN. Evidence (CODE at app-entry level): generativeMarathon 400/400 clean; full suite 11017 green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.117.0.'

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
