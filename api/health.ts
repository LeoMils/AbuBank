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
const BUILD_VERSION = '0.257.0-audio-trackA'
const BUILD_LABEL = 'AbuBank 0.257.0 — TRACK A audio (built now, flag-gated, owner-audible). The audio defects were deferred as "device-only" — that confused CANNOT-VERIFY with CANNOT-BUILD. Built: (1) far-field noise reduction on audio.input (VITE_LIVE_AUDIO_TUNE_V2) — the documented fix for a speakerphone hearing its own loudspeaker (self-interruption + a second overlapping voice); (2) client barge-in truncate (VITE_LIVE_BARGE_IN_TRUNCATE) — on a real barge-in, cancel the in-flight response and conversation.item.truncate the assistant item to the played position, so client+server agree and the next turn does not collide (the likely "only first sentence audible" cause). interrupt_response stays FALSE so the SERVER never truncates on echo — the correct COMBINED behaviour behind new flags, not a blind flip. Both env-overridable + OFF by default (payload byte-identical when off); enable TOGETHER (NR tames echo before the truncate is safe). CODE proven (liveAudioTrackA.test 8 + default-off safety in liveSession.test); audibility is the owner ear — docs/eval/AUDIO_CHECK.md (5 steps, A/B). Prior: scope inventory (v0.256).'

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
