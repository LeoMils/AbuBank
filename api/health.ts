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
const BUILD_VERSION = '0.141.0-seam-feeds-all-paths'
const BUILD_LABEL = 'AbuBank — SEAM_FEEDS_ALL_PATHS (INTAKE REBUILD, session 2 · P2 complete). The ONE relation-morphology seam now feeds EVERY path, not just who-is: calendar create/title ("תקבע עם בת הזוג של מור"→"פגישה עם יעל", "עם החתן של מור"→"פגישה עם גלעד"), search (personPhraseResolver now DELEGATES to the seam — the parallel per-form resolver engine was deleted, one runtime path per capability), and the ledger (extractChange/classifyIntake take an injected person-resolver so "הבת של מור גרה בחיפה" stores the fact for אופיר, not the anchor מור — and poison like "אופיר היא אשתו של רפי" still reaches THE LAWS unchanged and is refused). Added father/mother-in-law (חם/חמות) to the seam; hardened parseRelationQuery so a greedy capture of a leading preposition ("עם החתן") never hides the real phrase. Evidence: CODE — new all-paths suite 11/11 + morphology generative + FULL suite 11474 pass / 2 todo / 0 regressions (1 test updated: a create title now carries the RESOLVED name, per P4), typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P1 understanding-first LLM layer. Builds on 0.140.0.'

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
