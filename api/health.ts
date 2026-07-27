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
const BUILD_VERSION = '0.153.0-whatsapp-voice-compose'
const BUILD_LABEL = 'AbuBank — WHATSAPP_VOICE_COMPOSE (session 14). Abu WhatsApp voice/typed "כתבי הודעה בקול": Abu AI understands who + what + style, composes in her own voice (server gpt-4o → free tiers → deterministic local fallback), verifies facts, shows an EDITABLE draft, supports style switch and spoken/typed follow-up corrections, resolves the recipient by Hebrew name with fuzzy/STT tolerance and an ambiguity prompt (never a silent guess), and opens the WhatsApp chat of the chosen contact PRE-FILLED — manual send only, never auto-send. Reusable capability boundaries live in whatsappCompose.ts (intent/plan/style/compose/verify/follow-up) plus the channel adapter and privacy-safe telemetry. Fixed a real crash found in the browser smoke: an unhandled clipboard writeText rejection tripped the global error screen. Evidence: CODE — compose/resolve/parity unit suites green, typecheck + full suite (only pre-existing date-flaky calendar tests fail); BROWSER — Playwright smoke 5/5 (voice-injected and typed parity, ambiguity, no-phone, provider-failure fallback, exact wa.me prefill, iPhone-SE responsive). NOT device-proven: real microphone audio and the real WhatsApp handoff need a physical phone. Builds on 0.152.0.'

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
