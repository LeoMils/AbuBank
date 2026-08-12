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
const BUILD_VERSION = '0.214.0-transcription-prompt-cap'
const BUILD_LABEL = 'AbuBank 0.214.0 — the REAL string_above_max_length field, found by asking the provider. 0.213.0 capped the wrong field: the device still connected (gpt-realtime-2.1) and died ~500ms later. Posting the exact session.update to the real /v1/realtime/client_secrets endpoint named the field precisely — param: session.audio.input.transcription.prompt, message: "string too long. Expected a string with maximum length 1024, but got a string with length 1034". So the over-limit field was the Hebrew TRANSCRIPTION BIAS PROMPT (it enumerates every family name + alias and grew from under-cap to 1034 with the 68-person update), NOT instructions (9,656 chars were accepted fine — isolation proved removing the transcription prompt returned HTTP 200). Fix: buildTranscriptionPrompt is now bounded to a safe budget under the 1024 provider cap — it keeps the closest family (PRONUNCIATION_GROUPS is ordered closest-first) plus ALL request phrasings and drops the long tail; it is a weak STT bias side-channel, so a bounded subset is correct. Now 1000 chars. A whole-payload build-time guard (assertSessionPayloadWithinLimits) validates EVERY provider-capped field — instructions (self-imposed 10k) AND transcription.prompt (documented 1024) — at module load and inside buildSessionUpdate on the exact sent values, failing the build with the field, size and cap; a harness assertion covers the shared payload. The flight recorder now records the session.update size on the connect line, so the next trace shows the number directly. Verified against the REAL provider: the full payload the device sends went 400 → 200 (a valid realtime.session minted). Evidence: real-API 200 (the exact config now validates) + CODE tests + full suite + build. Not yet a full physical WebRTC session — needs a device reconnect on the deployed build.'

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
