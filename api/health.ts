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
const BUILD_VERSION = '0.167.0-durability-laws-and-gate-suites-rc'
const BUILD_LABEL = 'AbuBank — DURABILITY_LAWS + GATE_SUITES (session 43). Continues Claude-owned automatable QA across the remaining gates. GATE 4/1: durabilityLaws.test.ts encodes executable laws D3/D4/D6/D7/D8/D9/D10 against the REAL contact-storage functions, each with an injected mutant proving the check catches the defect (seed-overwrites-phones, migration-strips-phones, stale-Board-snapshot). GATE 5/D11: durableCommitContract.test.ts proves with a delayed backend that a fire-and-forget write is NOT durable until flush() resolves — the automatable equivalent of a hard kill in the race window; and the FIX ships: Contact Management import/save now AWAITS durable.flush() before reporting success, so "saved" can never precede the IndexedDB commit (the blocking invariant). GATE 6: injectedVoiceParity.test.ts drives injected SpeechRecognition events through the REAL DictationController to a final transcript, then through runCognitiveTurn (the SAME controller typed input uses), proving interim/final, early-onend+restart (no loss/dup) and a mid-utterance correction all route IDENTICALLY to typing — typed/voice parity is proven, not asserted. GATE 7: action-reachability.spec.ts upgrades DOM-presence to elementFromPoint not-obscured + in-viewport + >=44px at 3 iPhone viewports and composer-focused, on the deployed origin. Red-team pass also caught and FIXED a self-inflicted privacy regression (persistenceTrace.test.ts used non-allow-listed phone tokens). Evidence: CODE + TEST (new gate suites 32/32) + PREVIEW (reachability 4/4, 2-engine persistence lab). DEVICE: only the iOS storage-partition confirmation remains. Builds on 0.166.0.'

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
