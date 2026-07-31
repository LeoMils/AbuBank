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
const BUILD_VERSION = '0.153.8-device-replay-rc'
const BUILD_LABEL = 'AbuBank — DEVICE_REPLAY_RC (session 22). Finishes AbuAI Communication for restricted production. CALL is now first-class: a generic call CommunicationAction (mode=call, channel=phone) that the phone adapter turns into a sanitized tel: handoff resolved ONLY in the adapter (never in the controller, Action, or telemetry); AbuAI says "פותחת שיחה למור" and never dials. WhatsApp is the clear path: ONE primary action, WhatsApp is the review surface (no forced draft), the body is never read aloud; an explicit "תראי לי" shows an editable draft that reaches the adapter byte-for-byte. Meaning over transcript: a deterministic semantic pass resolves self-corrections (בארבע סליחה בחמש to five) and removes retracted content (אל תזכירי את X), while uncertainty/conditions/promises are preserved; the verifier keeps numbers/times/urls across styles. Default style is Martita authentic voice from the curated corpus; funny/abu keep facts. Missing telephone vs missing WhatsApp are handled separately. Evidence: CODE + TEST — production gates 21/21, targeted 89/89, full suite 0 new regressions vs the clean tree; BROWSER — Playwright 8/8. Fixes the device regression where a WhatsApp message whose BODY mentioned a meeting (e.g. תכתבי למור שיש לי פגישה מחר) was routed to Calendar: detection now anchors on the LEADING write/send/call verb, not calendar words in the body. Product Truth now sets BRAIN_PIPELINE_USED/EXECUTIVE_CONTROLLER_USED on the TEXT and pipeline-voice paths too (previously only the realtime path), so the flag reflects reality when OpenAI Realtime WebRTC is unavailable and voice falls back to Web Speech + pipeline TTS. The communication brain (routing/recipient/semantic/compose/verify) runs on every turn regardless of Realtime; the deployed gpt-4o chat proxy is verified alive. Evidence adds routing regression tests + BROWSER rc-verify 2/2. DEVICE NOT PROVEN. Builds on 0.153.4.'

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
