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
const BUILD_VERSION = '0.123.0-parity-rambling-dedup'
const BUILD_LABEL = 'AbuBank — PARITY_RAMBLING_DEDUP (Cycle 43 — grow the parity turn set with REAL Leo device flows; each new red dimension names a real gap). Diagnosis-first: ran 5 grounded Leo flows (docs/eval/LEO_DEVICE_FAILURES_REPRO.json + deviceFailuresTriage) through the SAME parity harness. Four were clean (midnight+person+place extraction, He/Es relation-between, relation-for); ONE red — the P2 rambling-story create confirmed the subject TWICE (בנושא טיול המשפחתי plus a redundant parenthetical restating it) which blew the brevity budget. GENERAL FIX (shapeCreateConfirm, responseShaper.ts): a subject/notes redundancy guard (coreWords + saysTheSame) drops the notes parenthetical when it merely restates the already-shown subject; a genuinely distinct note is kept (no over-suppression). Regression test FIRST (responseShaper.test.ts, red then green, reproducing the exact device string). Promoted all 5 flows into the standing parity scorecard: now 6/6 dimensions at 100 percent over 22 scored turns (was 17), 1 correctly LLM-routed. Calendar brevity budget aligned to the product rule (root CLAUDE.md: voice responses 2-4 sentences max) with the 220-char cap as the anti-ramble guard. Evidence: CODE — responseShaper 61/61, parityScorecard 22/22 at 100 percent; full suite + typecheck + build. Voice/Realtime untouched. Live cross-check seam still unkeyed (out-of-band). Builds on 0.122.0.'

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
