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
const BUILD_VERSION = '0.197.0-family-out-of-prompt-rc1'
const BUILD_LABEL = 'AbuBank 0.197.0 — FAMILY_OUT_OF_PROMPT_RC1 (D4): the family data is physically removed from the live instructions — the model now gets every family/people fact from the people_lookup tool (M3), not from embedded prose. The "# What Abu Knows — Family" section and the abu-family.md embed are gone; a short "# Family and People" routing instruction replaces them (call people_lookup for who / relationship / relatives / contact; never guess a name, gender, date or relationship; a phone number is never read aloud). The resolve_contact references in the instructions are replaced by people_lookup. Instruction size: 12978 → 9962 chars (−23%; the pure-removal floor is 9587, plus the people_lookup routing paragraph). abu-family.md remains only as legacy prose, no longer in the prompt; generating it FROM the one source is still staged. Also fixes a version-label sync bug from 0.196.0 (an apostrophe in that label truncated the health.ts BUILD_LABEL regex). Evidence: CODE + AUTOMATED TEST (instruction tests updated to the new structure; familyReconciliation + sharedConstruction green; full suite green; typecheck 0; build 0). On-device family speech via people_lookup is PHYSICAL_DEVICE — NOT claimed.'

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
