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
const BUILD_VERSION = '0.202.0-abuela-online-winner-m2'
const BUILD_LABEL = 'AbuBank 0.202.0 — ABUELA_M2 (online winner): ran the REAL provider tournament on the 36-question Hebrew corpus with all four keys live. Reachability first — Brave was failing 422 because the adapter pinned country=IL, which is not in the Brave country enum; removed it (Hebrew via search_lang=he) with a regression test. Matrix: incumbent OpenAI 61% citation / 3941ms avg / 8851ms p95 (inadequate for voice); Tavily 100% / 1963ms / 3228ms with a clean speakable Hebrew answer; Brave 100% / 784ms / 1132ms but only raw snippets (not speakable); Perplexity 100% / 4501ms / 6860ms, best reasoning but too slow. Winner = Tavily (only provider giving a voice-ready grounded Hebrew answer inside the latency budget). Wired behind /api/abuai-online via selectProvider(ONLINE_PROVIDER); the DEFAULT stays openai so production and existing endpoint tests are unchanged until the env flips. Same honesty gate (zero sources means decline), personal / family / calendar still never reach the web, key stays server-side. Re-ran through the WIRED endpoint against live Tavily: grounded answers in 0.2-1.6s, a calendar query blocked in 1ms. Evidence: CODE + AUTOMATED TEST (winner-path + grounding-gate + brave regression) + PREVIEW-class real API numbers (docs/eval/ONLINE_BAKEOFF.json). Latency note: Tavily p95 3.2s can exceed the 2s voice target on some queries — recommend a bounded client timeout with a truthful checking state; Brave is the sub-second fallback.'

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
