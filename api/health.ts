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
const BUILD_VERSION = '0.218.0-tool-timeout-honest-fallback'
const BUILD_LABEL = 'AbuBank 0.218.0 — FIX 5: a tool can no longer leave the model (and Martita) waiting on a silent hang. Two holes closed in the live tool executor: (1) the SYNC path had a try/finally with NO catch — a tool that threw never sent a function_call_output, so the model waited forever for a result that never came (the "people_lookup fired, no result arrived, both sides waited" hang). It now catches and always sends an honest error output ("could not do that just now", never a false success) so the turn completes. (2) the ASYNC online tool (get_current_info) had no timeout — a hung fetch never returned. It is now raced against an 8s budget (LIVE_TOOL_TIMEOUT_MS); on timeout it sends the honest "could not check current information" miss and lets the model speak it. Every non-returning call is LOGGED to the flight recorder (onToolIssue: name + error/timeout), so a stuck tool is visible in the trace instead of a silent wait. Evidence: CODE + AUTOMATED TEST (a never-resolving online fetch times out to no_result + logs; a throwing sync tool replies error + logs; the every-tool-speaks guarantee still holds). typecheck + full suite + build. Prior in this branch: FIX 1+2 one retrieval path (v0.215), FIX 4 the active-response crash (v0.216), FIX 7 announce-before-checking (v0.217). Still open: FIX 3 history retrieval, FIX 6 news/cinema depth, FIX 8 audio.'

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
