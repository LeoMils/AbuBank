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
const BUILD_VERSION = '0.128.0-voice-readiness'
const BUILD_LABEL = 'AbuBank — VOICE_READINESS (Cycle 48 — voice-readiness pack, code-level, no device claims). Three mechanisms, each RED-first, each wired (no dead code): (1) iOS mic constraints centralized to ONE source (services/audioConstraints MIC_GETUSERMEDIA: echoCancellation + noiseSuppression + autoGainControl) and applied at every primary capture site (recording, realtimeVoice, AbuCalendar, VoiceDebugPanel) — the constraints already existed but were duplicated 4x and could drift; a bare audio:true stays only as the iOS fallback. (2) Per-user speech profile (services/speechProfile) as the single source for spoken pace — NORMAL (1.0) by default per the standing law, changes ONLY by explicit user action; voice.ts getVoiceSpeed and the Settings speed control both go through it. (3) Cached instant warm openers (services/warmOpeners) — varied, warm, non-menu, He+Es time-of-day variants — wired into getVoiceGreeting behind a DEFAULT-OFF flag (abu-warm-openers) pending Leo blind listening, so zero behavior change until switched on. Also shipped the WEEKLY PARITY GUARD (src/eval/parityGuard.*: parity scorecard + marathon smoke + flight-recorder replay → dated PARITY_GUARD_LATEST.md; run PARITY_GUARD_WRITE=1 npx vitest run src/eval/parityGuard.test.ts) and refreshed docs/LEO_TYPED_TEST_SCRIPT.md to 31 numbered bilingual checks with exact expected answers from the preview E2E. Evidence: CODE — voiceReadiness 7/7, parityGuard 1/1 GREEN, full suite + typecheck + build. Physical audio is DEVICE evidence (not claimed). Builds on 0.127.0.'

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
