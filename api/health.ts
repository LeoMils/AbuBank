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
const BUILD_VERSION = '0.246.0-online-depth'
const BUILD_LABEL = 'AbuBank 0.246.0 — A (online DEPTH, price half): first-wins PAGE fetch so the perfume query returns a REAL price. The online path spoke from a search SNIPPET (a title + one-line description), which rarely carries a price — so "כמה עולה בלו דה שאנל" returned stores and "go check", never a number. New shared module firstWins.ts fetches the top result PAGES in parallel, extracts readable text, and speaks from the FIRST page that actually contains the answer (a real price token), aborting the losers, within a 4s soft / 6s hard budget (below the ceiling it returns what is known). Used by the eval instrument (firstWinsOnlineFetch) and, behind the default-OFF ONLINE_DEEP_FETCH flag, by the live endpoint api/abuai-online — device activation is one Vercel env step (like ONLINE_PROVIDER); with the flag off the endpoint behaves exactly as before and all its tests are unchanged. Never worse than the snippet: page content is used ONLY when a page truly contained the answer (hadAnswer), else the snippet stands (this protects the cinema case). Also fixed the instrument ttft to mean first SPOKEN token, not first event. MEASURED on the real gpt-realtime instrument: perfume BEFORE no price → AFTER "בערך 597 שקלים… 499… 749" (ttft ~3.0s, total ~3.8s, within the 4s budget); cinema unchanged via the snippet fallback. firstWins.test (8) locks winner/abort/ceiling/price-gate. STILL TODO in A: the prefetch warm-store (<1s for a prefetched topic) and the non-verbal in-flight cue. Prior: family portrait removed, relations ground on the resolver (v0.245).'

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
