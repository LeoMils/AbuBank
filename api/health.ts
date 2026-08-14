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
const BUILD_VERSION = '0.253.0-bundle-plan'
const BUILD_LABEL = 'AbuBank 0.253.0 — M5 per-intent decomposition (measured, reversible). Deletion is exhausted at 13,221 always-on instruction chars; <5,000 needs a STRUCTURAL change. intentInstructions.ts decomposes the SHIPPED instructions (buildLiveInstructions UNTOUCHED, byte-identical — flag-OFF payload unchanged) into an always-on CORE + intent blocks injected only when relevant. MEASURED: core 5,886 (safety 1.3k + persona 2.2k dominate); intent blocks family 2,065, profile 1,201, tools 4,063. Projected per-turn once injection is enabled: chit-chat 5,886, family 7,951, tools 9,949 — down from 13,221 every turn. HONEST LIMIT (asserted false-today so the ledger stays truthful): core is NOT yet <5,000 — reaching it also needs condensing the persona, which trades warmth and is a DEVICE off/on measurement, not a deletion. classifySections throws on any unclassified section so no rule is ever silently dropped. Loss-less decomposition proven (intentInstructions.test 9). ON-path wiring into liveSession + startup pre-warm are the device gates. Report: docs/eval/BUNDLE_SHRINK_PLAN.md. Prior: adversarial interception (v0.252).'

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
