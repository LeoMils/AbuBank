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
const BUILD_VERSION = '0.224.0-companion-suite-measured'
const BUILD_LABEL = 'AbuBank 0.224.0 — P9 measured, and the loop found real gaps. With credits added, the companion suite ran against the real model: 9 of 9 on the first pass. But reading the actual transcripts (the real judge, not the pass/fail) surfaced two gaps the checkmarks hid. One: PERSONA CONFUSION — asked about Mendoza she spoke as if SHE had lived there (בשבילי, גרנו) instead of telling Martita about HER own life. Two: DISTRESS INCOMPLETE — she told Martita to tap a button but never actually called the phone_call tool (so no card appeared) and omitted the 101 emergency number. Fixed both: a CRITICAL instruction that Abu is Martita FRIEND not Martita, telling her story in the second person and never as if she lived it; and a distress protocol that ACTUALLY calls phone_call (not a button it merely describes) and always names מד״א 101. Tightened the two scorers to measure these, then re-ran: 9 of 9 on the STRICTER checks — verified in the transcripts (history now: מהחיים שלך ושל פפי, הייתם חברים; distress now calls phone_call, הכנתי שיחה ללאו, names 101, and grounds her: איפה את נמצאת). Plateau: the residual is a loosely-labelled in-law term (the described path is correct, only the one-word term is loose); pushing further needs multi-turn LLM-judged scenarios and a device listen. Evidence: real-model companion suite 9/9 (twice, second time stricter) + CODE guards; typecheck + full suite (12,662) + build. Prior: Companion Brain P0-P3 (v0.220), P5 (v0.221), P8 names (v0.222), P9 suite (v0.223).'

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
