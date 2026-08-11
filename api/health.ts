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
const BUILD_VERSION = '0.210.0-family-knowledge-master'
const BUILD_LABEL = 'AbuBank 0.210.0 — master family knowledge update: merged the full human source of truth into knowledge/family_data.json, growing the family from 21 to 67 records (Martita birth family, Papi family, the Vancouver / LA / Mendoza branches, and the Kfar Saba + Argentine friends circle) — all MERGED not replaced, with distinct ids for the two Ariels and two Oscars, uncertainty and 25 open_questions tracked, the unresolved Yefi-maybe-Rafi bundle kept unattached, and PII (address / phone / national ID) intentionally excluded and documented. Wired a role-based extended_family group into the live people model, contacts and pronunciation so the new people are known and Spanish-pronounced in speech; deceased relatives are knowable but never reachable. Added Martita personal facts (hates cilantro + cinnamon, sweet white wine + shandy, loves TV / sushi, Tuesday at Mor, home as the gathering place, car, tech) to martita_personality.yaml and the live abu-knowledge profile. Fixed a response-shaper bug that mislabelled any husband-of-X as your-husband, and a normalizeName over-strip that collapsed Sharon into Ron. Evidence: CODE + AUTOMATED TEST — full suite 12387 green, all knowledge validators + build green, and a deterministic speech-reachability check (friend origins, two Ariels never confused, unknown to not-found, deceased decline).'

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
