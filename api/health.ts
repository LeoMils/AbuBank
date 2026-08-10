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
const BUILD_VERSION = '0.190.0-live-device-trace-fixes-rc1'
const BUILD_LABEL = 'AbuBank 0.190.0 — LIVE_DEVICE_TRACE_FIXES_RC1: four fixes from the first real-device trace. (1) DUPLICATE DISPATCH — the same completed call arrives in three event shapes (function_call_arguments.done / output_item.done / response.done) sharing one call_id; handleToolCall now dedups by call_id at the dispatch BOUNDARY so ONE model tool call = ONE execution (recorder, wait-ack, and calendar commit each fire once) — a triple confirm can no longer double an event. (2) HEBREW TRANSCRIPTION — gpt-4o-mini-transcribe → gpt-4o-transcribe, language pinned "he", plus a bias prompt built from the family Hebrew names/aliases + common request phrasings (buildTranscriptionPrompt). (3) BARGE-IN — server_vad threshold raised 0.5 → 0.7 (LIVE_VAD_THRESHOLD; prefix_padding/silence now exported constants) so brief room noise stops interrupting Abu, while interrupt_response stays true for genuine barge-in. (4) SILENT TURNS — a response.done that CARRIES a function call is no longer end-of-turn (grounded speech lands in the same turn), and wait_for_user is exempt from the silent-turn detector (its contract is silence). Recorder: each confirm_calendar_event entry records its confirmation source (voice / typed / inferred). Evidence: CODE + AUTOMATED TEST (regression tests for one-execution, mid-turn continuation, wait_for_user exemption, confirm provenance, transcription/VAD config; full suite green; typecheck 0; build 0). LLM harness BLOCKED here (no OPENAI_API_KEY). On-device transcription accuracy, barge-in feel, and audibility are PHYSICAL_DEVICE — NOT claimed.'

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
