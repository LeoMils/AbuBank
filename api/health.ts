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
const BUILD_VERSION = '0.148.0-correction-verify-and-toast'
const BUILD_LABEL = 'AbuBank — CORRECTION_VERIFY_AND_TOAST (INTAKE REBUILD, session 9 · P7 + P8). P7 correction-verification: when Martita corrects the FACTS of a prior ONLINE answer ("לא נכון", "טעית", "בעצם זה…"), runtimeFullTurn now RE-SEARCHES that topic (conversation focus=online → re-run the online tool) instead of blind-agreeing — a false "you are right" is worse than a re-check. Only overrides when the runtime would otherwise merely chat/fall back; deterministic domains keep priority; a plain "לא/לא תודה" is NOT treated as a factual correction. P8: killed the "אבחון הקול הועתק" chat-bubble spam — repeated taps no longer append duplicate confirmations (dedup on the last message). Evidence: CODE — correctionVerification 5/5 (incl. a live turn: a correction after a weather answer re-runs the online tool with the topic and does NOT blind-agree) + FULL suite 11542 pass / 2 todo / 0 regressions, typecheck + build. P8 is a UI onClick (BROWSER-class, verified by inspection, not unit-tested). Real online retrieval quality = PREVIEW. NOT device-proven; only the Leo free-language round decides readiness. NEXT: the verification regime (full corpus green + fresh preview deploy + internal free-language simulation) — the deploy is human-gated. Builds on 0.147.0.'

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
