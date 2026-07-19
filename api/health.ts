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
const BUILD_VERSION = '0.133.0-weakness-map'
const BUILD_LABEL = 'AbuBank — WEAKNESS_MAP (Cycle 53 — REVOLUTION mandate, session 3: proof c, the last). Built the weakness map (Constitution §5): src/truth/weaknessMap.ts auto-classifies every real miss from the flight-recorder reality into a failure ARCHETYPE — answer-not-the-question, phrase-not-resolved, fabricated-fact, capability-denial, repeated, rejected — tagged by domain + language. The detectors are domain-AGNOSTIC (the same predicate runs across calendar/family/memory/online). mineTranscript over Leo real stale-round turns yields the archetype map. CROSS-DOMAIN PROOF (c): the phrase-not-resolved archetype was closed in CALENDAR (Cycle 50) but the cross-domain probe caught it still OPEN in FAMILY — "מי החתן של רפי" / "מי הכלה של רפי" punted to the LLM. ONE general fix closes it across both domains: looksLikeFamilyQuery now recognizes in-law relation words (חתן/כלה/גיס/נין) so the who-is routes to the family engine, and familyReasoner resolves the phrase via the SAME resolvePersonPhrase the calendar uses (מי החתן של רפי → החתן של רפי הוא גלעד). Locked forever by the cross-domain probe suite (calendar + family). Evidence: CODE — weaknessMap 3/3, full suite 11083 pass / 2 todo, typecheck + build; no family/parity regressions. REVOLUTION proofs a,b,c,d,e,f ALL delivered. Remaining (product): the canonical Hebrew ledger FILE + conversation write path + birthdays→calendar. Builds on 0.132.0.'

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
