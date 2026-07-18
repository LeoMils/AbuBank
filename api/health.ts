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
const BUILD_VERSION = '0.127.0-normal-speech-pace'
const BUILD_LABEL = 'AbuBank — NORMAL_SPEECH_PACE (Cycle 47 — latency pack: un-slow the voice by default). Standing law: the benchmark is the latest ChatGPT at NORMAL human speech pace, never slowed by default. The applied TTS speed for BOTH the primary OpenAI path (voice.ts speed: getVoiceSpeed) and Web Speech (u.rate) flows through getEffectiveRate → getVoiceProfile(lang).rate — which defaulted to 0.95 (He) / 0.97 (Es), i.e. slowed ~5%, and the Settings scale maxed at 0.95 (even fast was below normal). FIX: HE_VOICE.rate and ES_VOICE.rate → 1.0 (normal), and the Settings speed scale re-centered on 1.0 (איטי 0.9 / רגיל 1.0 / מהיר 1.1) with the default 1.0; a user who wants slower can still pick it (override honored + clamped 0.8–1.15). RED-first: the old voiceConfig test ENCODED the slowed default (rate <= 1.0, > 0.88) — rewritten to assert the standing law (default === 1.0), red before the fix. Realtime path paces itself (model-voiced), unchanged. Latency table recorded (docs/eval/LATENCY_TABLE.md): deterministic 0.31–0.68s < 1s (PREVIEW-measured), LLM ~4s, online 4.8–6.8s. Evidence: CODE — voiceConfig 6/6, full suite + typecheck + build. Physical audio pace is DEVICE evidence (not claimed here). Builds on 0.126.0.'

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
