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
const BUILD_VERSION = '0.132.0-champion-challenger-duel'
const BUILD_LABEL = 'AbuBank — CHAMPION_CHALLENGER_DUEL (Cycle 52 — REVOLUTION mandate, session 2: the promotion gate). Built the Learning-Loop safety capstone (Constitution §6): a build is promotable ONLY if it beats the previous on the ENTIRE corpus with NO dimension regressing. corpusScore (src/eval/duel.ts) REUSES the existing engines — runParityGuard (parity 6 dims + marathon smoke + flight-recorder reality) + the metamorphic mirror suite (1380 mirrors) — scored into one per-dimension scorecard; no parallel path. duel() is a pure comparison: a single regressed dimension (or lost coverage) BLOCKS promotion and is named. runWeeklyDuel scores the current build, duels it against the stored champion baseline (docs/eval/CHAMPION_BASELINE.json), advances the baseline only on a pass, and writes Leo one plain-Hebrew line to docs/eval/DUEL_LATEST.md: "השבוע: X נתפסו, Y תוקנו, Z חזרו (חובה: 0 חזרו) — עבר/נחסם". PROOF (d) delivered: a deliberately regressed challenger (mirror breaks introduced) and a coverage-loss challenger are both BLOCKED and named; an equal/improved build passes. Evidence: CODE — duel 7/7 (corpus mirrors 1380, all dims green), full suite 11080 pass / 2 todo, typecheck + build. Deferred (final session): (c) weakness-map archetypes + cross-domain probes; ledger file + conversation write-path + birthdays→calendar. Builds on 0.131.0.'

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
