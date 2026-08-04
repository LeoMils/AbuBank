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
const BUILD_VERSION = '0.173.0-realtime-truthmonitor-forward-hebrew-fp-rc'
const BUILD_LABEL = 'AbuBank — REALTIME_TRUTHMONITOR_FORWARD_HEBREW_FP (ADR-0001 §7/§16). Fixes two truth-monitor FALSE POSITIVES in normal forward Hebrew found by a production-convergence audit: (1) the "כבר…" completion group carried 2nd-person "שלחת" ("YOU sent"), so an assistant question like "כבר שלחת לו?" was wrongly flagged as a fabricated 1st-person completion and would trigger a nonsensical self-repair; (2) "דיברתי עם" lacked the "לא " negation guard every other completion verb had, so "לא דיברתי עם מור" over-blocked. Both now require the negation guard and count only first-person claims; positive fabrications ("כבר שלחתי", "דיברתי עם … והכל סודר") stay caught. Red-first regression tests added. Evidence: CODE + TEST (truthMonitor + realtimeLivePath + realtime slice green; typecheck 0; full suite 11940). PHYSICAL-ONLY unchanged. Builds on 0.172.0. — REALTIME_LIVE_FUNCTIONTOOL (ADR-0001 §12/§17-5). Wires the ACTUAL live WebRTC Realtime function-tool path behind ?voice=realtime2 (needs the realtime beta; OFF by default; certified brain-driven voice path unchanged). buildRealtimeSessionUpdate declares session.tools (prepare_whatsapp/prepare_call/replace_active_action/cancel_active_action) + tool_choice auto + create_response TRUE ONLY in slice mode; RealtimeVoiceSession routes a completed function_call (response.output_item.done / response.function_call_arguments.done / response.done) through realtimeFunctionBridge → RealtimeCommController → SessionOrchestrator (control plane commits, kernel resolves via the ONE buildCommunicationAction authority) → SAFE function_call_output (never a number/completion) + response.create → the model speaks grounded, guarded by the streaming truth monitor (fabricated completion / unsupported denial → repair next turn + incident). The committed ActiveActionViewModel renders the canonical in-session ActiveActionCard while the conversation stays live. Idempotent by model call_id; recipient/revision/generation on every receipt; atomic Call↔WhatsApp replace. FIX: the truth monitor no longer over-blocks a NEGATED completion ("לא נשלח") — a false-positive the live-path campaign caught. Evidence: CODE + TEST (realtime slice suite incl. a production-faithful RealtimeVoiceSession adapter journey via injected server events, tool schemas, event bridge, live controller, negation regression; typecheck 0; build green; full suite). PHYSICAL-ONLY: the real mic→model→tool→audio round-trip + Hebrew naturalness per §20 — not claimed. Builds on 0.170.0.'

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
