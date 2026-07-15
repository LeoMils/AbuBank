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
const BUILD_VERSION = '0.98.0-math-calculator'
const BUILD_LABEL = 'AbuBank — MATH_CALCULATOR (Intelligence Parity Cycle 19, text-only via the real ExecutiveCognitiveController): a far wider adversarial probe (all of life) surfaced that everyday arithmetic — כמה זה 15 כפול 4, 200 חלקי 8, 20 אחוז מ-200, 15 אחוז טיפ על 240 שקל — fell to the LLM, which is unreliable at math. Added a deterministic mathReasoner (multiply/divide/add/subtract via Hebrew + Rioplatense operator WORDS and the true × ÷ symbols; percent-of; percent-tip with total; He + Es output) + a new math intent routed before online. isMathQuery only matches a real expression, so a price question (כמה עולה חלב) still routes online, and ASCII + - * / are excluded so times/dates/ratios (3-5, ב-3) are never mis-read as math. 15 כפול 4 → זה יוצא 60; 20 אחוז מ-200 → 40; 15 אחוז טיפ על 240 שקל → טיפ 36, בסך הכל 276. Evidence: mathReasoner.test.ts 8/8 green (CODE); math + calendar + online regression suites 333 green; full suite green. NOTE: unit conversions (km/kg/°C) + currency FX (live rate) are NOT yet deterministic — next cycles / online. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.97.0.'

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
