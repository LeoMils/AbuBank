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
const BUILD_VERSION = '0.194.0-live-online-tool-rc1'
const BUILD_LABEL = 'AbuBank 0.194.0 — LIVE_ONLINE_TOOL_RC1 (live-wiring + honesty-guard): Abu can now answer CURRENT facts in the live conversation via a real grounded tool. New async live tool get_current_info (LiveTools) POSTs to the server-side grounded /api/abuai-online (key server-only, no-sources honesty gate) and lets the model speak ONLY what it returns, with its source; no verified result ⇒ an honest "I could not check", NEVER a current fact from memory. LiveTools gained its FIRST async tool — it keeps the call-id in-flight and replies when the round-trip returns, deduped exactly-once like the sync tools. HONESTY GUARD INVERTED (authorized): news/weather/cinema were REMOVED from TOOLLESS_CAPABILITY_GUARD and their "do NOT" disclaimers dropped — they now have a tool; memory + games stay disclaimed. Instructions now require get_current_info for anything current/live and forbid answering a current fact from memory. Evidence: CODE + AUTOMATED TEST (async tool grounded/no-result/thrown/exactly-once; guard-teeth retargeted to memory+games; full suite 12273 pass, typecheck 0, build 0). REAL PROBE (key reachable, NOT blocked): web_search grounding is INCONSISTENT — the provider attaches url_citations for some queries but not others; when uncited the endpoint correctly returns an HONEST NO_RESULTS and never fabricates. So the tool is wired + safe, but reliable real answers still need provider/prompt tuning — NOT claimed. On-device speech is PHYSICAL_DEVICE — NOT claimed.'

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
