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
const BUILD_VERSION = '0.150.0-shadow-validated-retirement'
const BUILD_LABEL = 'AbuBank — SHADOW_VALIDATED_RETIREMENT (INTAKE REBUILD, session 11 · standing obligations #2/#6/#13/#14). Discharged the SHADOW-VALIDATION law for the family intake: built a reusable shadow harness (src/eval/intakeShadow.ts) that runs the OLD pattern intake and the NEW morphology seam in PARALLEL over a 1419-turn corpus and classifies every divergence. Result — agree=1101, RECOVERED=318 (in-laws/possessive/garble the legacy intake punted), REGRESSED=0, DISAGREE=0 → the seam is a proven strict SUPERSET. Retirement criterion (regressed=0 AND disagree=0) MET, so the legacy REL pattern list was RETIRED from the live path (answerFamilyRelation is now seam-ONLY) and quarantined in legacyFamilyIntake.ts as the shadow baseline only — one intake per capability, not two. First added the seam superset piece it was missing (the "ממי X גרושה" from-whom ex shape). Standing obligations recorded as repo law in docs/engineering-os/STANDING_PROOF_OBLIGATIONS.md. Evidence: CODE — intakeShadow 5/5 (0 regress, 0 disagree, 318 recovered) + FULL suite 11552 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides ready. NEXT: fail-closed suite (#9), latency stage KPIs (#8), shadow over create/ledger paths, meaning-cache (#10), transcript→gold pipeline (#11). Builds on 0.149.0.'

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
