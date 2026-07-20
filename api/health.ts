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
const BUILD_VERSION = '0.144.0-garble-tolerant-seam'
const BUILD_LABEL = 'AbuBank — GARBLE_TOLERANT_SEAM (INTAKE REBUILD, session 5 · P3). Added deterministic garble-tolerance to the relation seam: a Hebrew phonetic fold (ק/ך/ח→כ, ט→ת, ע→א, ב→ו, finals) lets a single near-homophone STT slip in a relation TERM still resolve — "החטן של מור"→גלעד, "הגרבש של מור"→רפי, "בט הזוג של מור"→יעל — instead of punting. Gated to terms ≥3 chars and UNAMBIGUOUS folds (a fold that maps to two relations is refused), so it never mis-maps one relation to another; a garbled phrase resolves to a real relative or to nobody, NEVER a wrong person. Plus a permanent garble mutator (src/truth/garbleMutator.ts, index-seeded, no randomness: near-homophones + ה-noise + word split/join) and the P3 suite (measures a survival floor honestly — word-SPLIT garble is left to STT-recovery/the P1 layer, not hidden). Evidence: CODE — garble 16/16 + FULL suite 11512 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P4 calendar state-machine audit → P5–P8 → verification regime. Builds on 0.143.0.'

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
