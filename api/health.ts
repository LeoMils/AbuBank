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
const BUILD_VERSION = '0.170.0-realtime-slice-harness-rc'
const BUILD_LABEL = 'AbuBank — REALTIME_SLICE_HARNESS (ADR-0001 §18). Wires the deterministic Realtime authority stack (control plane = STATE, tool-dispatch→kernel = TRUTH, streaming truth-monitor = SPEECH-GUARD) into a headless SessionOrchestrator with an injectable, mic-free event seam, projecting ONE canonical ActiveActionViewModel rendered by ActiveActionCard. A self-contained harness behind ?voice=realtime2 (OFF by default; the certified voice path is untouched) lets an operator inject the exact device-failure journey — WhatsApp card → "לא, תתקשרי אליו" atomic REPLACE to Call → complaint (no mutation) → interruption → fallback — with NO mic, so the §18 falsifier is provable by clicking in a deployed Preview. Kernel modes: PRODUCTION (the single buildCommunicationAction authority — slice and typed path cannot fork into two truth owners) or SIMULATED-READY (§19). No completion status is representable; a fabricated "שלחתי/התקשרתי" is blocked before voicing; no phone number enters the control plane or a tool arg; recipient/revision/generation carried on every receipt (stale + cross-generation results rejected). Evidence: CODE + TEST (54 tests: controlPlane 16 · realtimeTools 9 · truthMonitor 6 · sessionOrchestrator 9 · slice flag 14; typecheck 0; build green). BROWSER/PREVIEW = the deployed §18 click-through; DEVICE (mic naturalness/audibility) remains physical-only per §20 — not claimed. Builds on 0.169.0.'

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
