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
const BUILD_VERSION = '0.140.0-relation-morphology-seam'
const BUILD_LABEL = 'AbuBank — RELATION_MORPHOLOGY_SEAM (INTAKE REBUILD, session 1 · P2). Understanding-first groundwork: mapped the current pattern-bound intake (chat=runCognitiveTurn/classifyIntent, calendar=isCreateIntent, ledger=classifyIntake/extractChange) and built the ONE morphology normalization seam for Hebrew relation terms — src/truth/relationMorphology.ts. A table-driven inflection space (bare, definite ה־, construct, possessive suffixes אמו/בתה/כלתו/חתנו/גיסתה, analytic בן הזוג, plurals) → canonical RelationType, consumed by answerFamilyRelation as the gate (legacy REL kept only as fast-path fallback for the not-yet-migrated ממי-גרושה shape). NEW capability the old pattern intake could not resolve: in-law who-is — "מי החתן של מור"→גלעד, "מי הכלה של מור"→ירדן — plus every inflection of a term now resolves to the same person instead of punting to the LLM. Honest emptiness preserved (Ofir has no aunt → known=false, never invented). Generative suite (310, auto-generated from the table × the live graph). Evidence: CODE — morphology 310/310, FULL suite 11433 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. Remaining mandate P1 (LLM understanding layer), P3–P8 + verification regime: NOT started. Builds on 0.139.0.'

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
