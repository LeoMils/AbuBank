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
const BUILD_VERSION = '0.147.0-no-fabrication-guard'
const BUILD_LABEL = 'AbuBank — NO_FABRICATION_GUARD (INTAKE REBUILD, session 8 · P6). A pre-emission hard law: an LLM/fallback answer may NEVER assert a specific appointment (the "1 באוקטובר" hallucination class) — calendar is deterministic, never the LLM. guardNoFabricatedCalendar runs before finalize in runtimeFullTurn: an APPOINTMENT FRAME (יש לך/קבעתי/התור/הפגישה) + a concrete date/clock in an LLM-sourced answer is neutralized to an honest deferral ("בואי נבדוק ביומן ביחד…"). PRECISE: ordinary prose + historical dates ("המהפכה ב-1789") pass untouched; the deterministic calendar engine + online answers are trusted and never scrubbed. Evidence: CODE — noFabricationGuard 6/6 (incl. a live turn where an LLM invents "פגישה ב-1 באוקטובר" and it is scrubbed from the display) + FULL suite 11536 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P7 correction-verify → P8 toast → verification regime. Builds on 0.146.0.'

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
