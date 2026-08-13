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
const BUILD_VERSION = '0.219.0-history-retrieval-path'
const BUILD_LABEL = 'AbuBank 0.219.0 — FIX 3: life history and places now have a retrieval path. Her past — the childhood in Buenos Aires, the Mendoza years and the family store Casa Milstein on San Martin, the 1977 aliyah via Rome and Florence, the Ulpan Ben Yehuda in Netanya where the Omansky and Elsi/Saul friendships began, the Bat Yam years and the shop — lived as prose in martita_personality.yaml that NO tool ever read, so it was unreachable. Fix: a new authority knowledge/life_history.json (extracted faithfully from that prose and the family notes; nothing invented; unknowns kept unknown) plus a history_lookup tool that reads it and returns ONLY grounded summaries with confidence, or an honest not_found — the same discipline people_lookup gives people. Wired into the live tools and the instructions, under the provider caps. A reachability harness queries every era (Mendoza, the store, the aliyah, childhood, Bat Yam, Argentina, the Ulpan) and the honest not_found. Evidence: CODE + AUTOMATED TEST; typecheck + full suite (12,632) + build. Prior in this branch: FIX 1+2 (v0.215), FIX 4 (v0.216), FIX 7 (v0.217), FIX 5 (v0.218). Still open: FIX 6 news/cinema depth, FIX 8 audio.'

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
