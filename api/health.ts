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
const BUILD_VERSION = '0.153.2-communication-capability'
const BUILD_LABEL = 'AbuBank — COMMUNICATION_CAPABILITY (session 16). AbuAI now returns a generic, channel-agnostic CommunicationAction when the final intent is "communicate": the cognitive controller (runFullTurn) composes and VERIFIES the message, and the chat renders a generic card — the reviewed, editable draft plus ONE primary action supplied by the channel adapter (WhatsApp is the first: "פתחי בוואטסאפ"). Pressing it opens the correct conversation with the EXACT reviewed (even edited) text prefilled — never modified, never auto-sent. New abstraction: communication/{types,registry,capability}, an AbuWhatsApp channel adapter, and a generic CommunicationActionCard rendered from ChatMessage.action (mirrors the error to ErrorCard pattern). SMS/Email/Telegram can plug in as adapters with NO controller change. The Action is pure data — no phone number leaks into it. An explicit calendar-create wins over the communication precedence so a "…ותכתבי להביא…" note is not mis-sent. Evidence: CODE — communication/capability 7/7, whatsappTurnRouting 11/11, full suite (only pre-existing date-flaky calendar tests fail, identical to clean tree); BROWSER — Playwright 8/8 including edit-preserved exact wa.me prefill and no auto-send. Builds on 0.153.1.'

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
