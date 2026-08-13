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
const BUILD_VERSION = '0.217.0-no-announce-before-checking'
const BUILD_LABEL = 'AbuBank 0.217.0 — FIX 7: the announce-before-checking preamble ("אני אבדוק במקורות" and its Spanish twin) that survived five sessions. Mechanism confirmed before removing anything: the LIVE VOICE path emits no pre-tool speech in code (liveSession/liveTools inject none) — the preamble is the realtime MODEL generating filler under a rule that only forbade present-tense fillers, never the future-tense "אבדוק", the "sources" variant, or the Spanish "lo miro". The codebase seed of those exact phrases, src/screens/AbuAI/instantAcknowledgement.ts, turned out to be DEAD (no runtime caller — test-only), so it was not the live source but a latent seed. Fix: (1) the live "# Before a Tool Call" rule is rewritten to forbid announcing a check in ANY language or tense, naming the exact phrases, with "the FIRST words out of your mouth are already the answer". (2) the instantAcknowledgement seed is neutralised — every tool/lookup mode now returns an empty ack (stay silent) and only warm non-announcing conversational openers remain. (3) a BUILD-FAILING guard (announceBeforeChecking.guard.test.ts) asserts the strong live rule is present AND that no ack can announce a check, so the phrasing can never be re-seeded. Instructions stay under the 1024/10000 provider caps. Evidence: CODE + AUTOMATED TEST. Not device-proven that the model now never preambles — that is model behaviour under the strengthened instruction and needs a device listen. Prior in this branch: FIX 1+2 (v0.215) one retrieval path, FIX 4 (v0.216) the active-response crash. Still open: FIX 5 tool timeouts, FIX 3 history retrieval, FIX 6 news/cinema depth, FIX 8 audio.'

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
