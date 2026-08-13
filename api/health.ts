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
const BUILD_VERSION = '0.216.0-active-response-nonfatal'
const BUILD_LABEL = 'AbuBank 0.216.0 — FIX 4: the conversation_already_has_active_response crash that killed a session every minute is fixed. Mechanism: the Realtime API allows ONE active response at a time, and with interrupt_response FALSE (kept, it is the echo/truncation fix) the server never clears the active one — so when the user spoke while a response was in flight (a tool call open), the VAD create_response collided, the error came back, and the handler called fail() and tore the whole session down. Fix: (1) response.create is now gated behind an active-response tracker (set on response.created / our own send, cleared on response.done); a create requested while one is active is DEFERRED and flushed on response.done, so we never self-collide (tool results, the typed calendar confirm, the greeting). (2) The race itself is NON-FATAL — conversation_already_has_active_response and response_cancel_not_active are recorded as recoverable, never fail the session — and the buffered user turn is answered with a fresh response once the in-flight one completes, so a barge-in is handled instead of lost. Evidence: CODE + AUTOMATED TEST (liveSession regressions: non-fatal, deferred-then-flushed, buffered-turn-answered; full suite + build). Not yet device-proven that sessions now survive a full call — needs a physical reconnect. Prior in this branch: FIX 1+2 (v0.215) one retrieval path for all 68 people plus Hebrew path descriptions (reachability harness 215/215). Still open: FIX 3 history retrieval, FIX 5 tool timeouts, FIX 6 news/cinema depth, FIX 7 the instantAcknowledgement preamble seed, FIX 8 audio.'

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
