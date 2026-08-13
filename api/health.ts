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
const BUILD_VERSION = '0.225.0-mutation-harness-label-guard'
const BUILD_LABEL = 'AbuBank 0.225.0 — Phase M: the test of the tests. Built the missing mutation harness (scripts/mutation-harness.mjs) and pointed it at deterministic guards. First run: 80% kill (4/5). The survivor was real — swapping the feminine/masculine grandchild term in familyRelationEngine (נכדה⇄נכד) passed the ENTIRE 12662-test suite, verified by running the full suite against the mutation. Mechanism: labelFor() emits female?pair[0]:pair[1] and relationOf() speaks it to Martita, so a swap calls a granddaughter "נכד" (grandson) — the existing ofirGenderRegression guards the gender DATA field but never the OUTPUT label. Closed it with a generalized red-before-green property test (familyRelationLabelGender.test.ts) over the live graph: every female grandchild must be נכדה, every male נכד-not-נכדה. Re-ran the harness: 100% (5/5), negative control still survives. Not a live bug today — a closed blind spot the suite can now feel. Evidence: harness 5/5 + typecheck + full suite (12,666) + build; docs/warroom/ holds the coverage matrix and the honest empty cells. Prior: P9 measured (v0.224).'

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
