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
const BUILD_VERSION = '0.153.4-communication-production-rc'
const BUILD_LABEL = 'AbuBank — COMMUNICATION_PRODUCTION_RC (session 18). Finishes AbuAI Communication for restricted production. CALL is now first-class: a generic call CommunicationAction (mode=call, channel=phone) that the phone adapter turns into a sanitized tel: handoff resolved ONLY in the adapter (never in the controller, Action, or telemetry); AbuAI says "פותחת שיחה למור" and never dials. WhatsApp is the clear path: ONE primary action, WhatsApp is the review surface (no forced draft), the body is never read aloud; an explicit "תראי לי" shows an editable draft that reaches the adapter byte-for-byte. Meaning over transcript: a deterministic semantic pass resolves self-corrections (בארבע סליחה בחמש to five) and removes retracted content (אל תזכירי את X), while uncertainty/conditions/promises are preserved; the verifier keeps numbers/times/urls across styles. Default style is Martita authentic voice from the curated corpus; funny/abu keep facts. Missing telephone vs missing WhatsApp are handled separately. Evidence: CODE + TEST — production gates 21/21, targeted 89/89, full suite 0 new regressions vs the clean tree; BROWSER — Playwright 8/8. DEVICE NOT PROVEN (real tel:/WhatsApp handoff and no-auto on a physical iPhone). Builds on 0.153.3.'

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
