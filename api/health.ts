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
const BUILD_VERSION = '0.245.0-bundle-shrink'
const BUILD_LABEL = 'AbuBank 0.245.0 — G+D: the duplicated family portrait is removed from the live bundle, and relation queries now GROUND on the deterministic resolver. The instructions carried a 10,902-char family portrait (44% of the bundle) — data that already lives behind people_lookup — which is why relation queries answered from the prompt (0 tool calls) with a derivation chain instead of calling the resolver. Change: the portrait is removed entirely (import + call gone, module deleted); the # Family and People section is rewritten to ground every who/relationship/relatives answer through people_lookup (silently, per-intent, ONE short sentence, the relation only, no derivation), life story through history_lookup, and to accept a correction about her own family AT ONCE and never argue; the # Tools and Actions bullets flip from answer-from-prompt to call-the-tool. Instructions 24,513→13,855 chars; payload 36,863→26,188; a shrink-ratchet test locks the cut and ratchets toward the 5,000 target. Deterministic acceptance: bundle-size ratchet asserted, full Hebrew pair matrix green (relationMatrix.test), one-sentence relation. MEASURED on the real gpt-realtime instrument: relation tool-call rate 0/5→5/5 (עדי/לאו → people_lookup → "עדי בן של לאו"); collateral online/calendar/comm unchanged. Realtime stays the behavioral instrument; the throttle is handled by pacing + backoff + connect-error exclusion, never by demoting to the chat harness. Prior: one reconciled live-state indicator + QA badge hidden (v0.244).'

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
