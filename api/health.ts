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
const BUILD_VERSION = '0.260.0-general-search'
const BUILD_LABEL = 'AbuBank 0.260.0 — ONE GENERAL online search loop, no per-topic gates. Deleted the price-specific relevance gate (isPriceQuery/priceNearProduct/price-token extraction) and replaced the per-intent patchwork with a general agentic loop (generalSearch.ts): SEARCH → FETCH pages first-wins → a CHEAP MODEL JUDGES+SYNTHESIZES one clean answer (no type heuristic) → REFINE the query once if it misses (budget permitting) → HONEST no_answer instead of a dump. synthesize.ts generalized to every question kind; firstWins.ts de-priced to a general content screen. Wired into the live tool (firstWinsFetch) + the endpoint (abuai-online). ACCEPTANCE (63 diverse he/es questions, real Brave+fetch+gpt-4o-mini): PASS 55/63 = 87.3%, 0 hard fails, 0 source-name leaks, 8 honest misses (JS-rendered listings / live widgets); latency p50 2180ms p95 5237ms max 5622ms (all in the 6s ceiling — a synth-time reserve keeps fetch+judge under budget). Never worse than the snippet MEASURED: OFF-only 0, ON-only 2. ORACLE LIMIT stated: pass = a real answer of the requested KIND, no source named, in budget — the VALUE is not asserted (no oracle). ONLINE_DEEP_FETCH moved from a Preview env var to a CODE flag (flags.ts) DEFAULT ON (survives a merge); prefetch warm default OFF pending device measurement. Report docs/eval/ONLINE_ACCEPTANCE.md. Prior: source gaps (v0.259).'

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
