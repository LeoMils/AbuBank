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
const BUILD_VERSION = '0.149.0-verification-regime'
const BUILD_LABEL = 'AbuBank — VERIFICATION_REGIME (INTAKE REBUILD, session 10 · P1-P8 complete). Closes the intake-rebuild mandate on the CODE side. (1) FULL corpus clean: 387 files / 11546 tests pass / 0 regressions (marathon + mirrors + morphology + garble + all guards). (2) Internal FREE-LANGUAGE SIMULATION (src/eval/freeLanguageSimulation.test.ts): 300+ generated free-form utterances crossing the morphology table × garble × every family member × the intake paths (who-is / create-title / correction), asserting the rebuild invariants at scale — never throws, a resolved person is ALWAYS a real family member (never fabricated/wrong), a garbled term resolves right OR to nobody, a create with a relation companion stores the RESOLVED name, no output is a capability-denial. (3) A 10-line plain-Hebrew Leo test card (docs/engineering-os/LEO_FREE_LANGUAGE_TEST_CARD.md). HONEST LIMITS: the mandate 200-session run through the DEPLOYED app + on-device voice/latency is PREVIEW/PHYSICAL and is NOT done here; the Vercel Preview auto-builds on push but promotion is human-gated and I could not fetch its URL from this environment. Evidence: CODE + local simulation. NOT device-proven — only the Leo free-language round decides ready. Builds on 0.148.0.'

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
