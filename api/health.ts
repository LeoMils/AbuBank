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
const BUILD_VERSION = '0.207.0-online-diagnostic'
const BUILD_LABEL = 'AbuBank 0.207.0 — online provider DIAGNOSTIC + Tavily fix: /api/abuai-online now returns a non-secret diag on EVERY response (requested + resolved provider, providerKeyPresent, openaiKeyPresent, reached, sourceCount, outcome) so a misconfigured provider can never again look identical to a search that genuinely found nothing. Both client callers (live get_current_info seam + the text answerOnlineCurrentInfo path) capture + console.info the diag and expose lastDiag on the operator health snapshot. Root-cause fix: the Tavily adapter pinned topic=news, which restricts Tavily to recent news ARTICLES and returns ZERO results for the non-news current queries the endpoint also serves (rates, hours, shabbat, holidays) — zero results then trip the honesty gate and read as no_result; removed the pin so Tavily runs a general current-info search. Regression tests added: diag distinguishes missing-key (reached=false) from empty-search (reached=true, sourceCount=0), and the Tavily body no longer pins topic=news. Evidence: CODE + AUTOMATED TEST (33 online endpoint/provider + 44 client/liveTools green). Vercel: confirm ONLINE_PROVIDER=tavily is visible (non-sensitive) for the Preview env + rc5, TAVILY_API_KEY present, and REDEPLOY after setting; then one request shows the diag truth.'

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
