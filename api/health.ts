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
const BUILD_VERSION = '0.198.0-abuela-brand-foundation-rc1'
const BUILD_LABEL = 'AbuBank 0.198.0 — ABUELA_BRAND_FOUNDATION_RC1 (M4 foundation): the chosen Night Garden brand direction, built THEMEABLE. A CSS-variable theme (src/design/theme.css + theme.ts) flips the whole product from the dark Night Garden palette to a light Bright Day palette by ONE attribute (data-abu-theme) — no rebuild, no re-render (condition 1). A per-app Abu logo FAMILY as SVG components (src/design/logos/AbuLogo): seven luminous emblems (AI / News / Bank / WhatsApp / Weather / Games / Calendar) sharing one construction — a glow disc, an accent rim, and the constant Abu spark — with a distinct glyph + constellation accent each, unmistakably one family. The HUB now uses the logo marks + themeable tokens + the Night Garden page background. A character STILL FRAME for M5 direction 3 (docs/design/abu-bust-still.svg + .png) is delivered for approval BEFORE any animation (condition 2). Applied so far to the hub only; rolling the system + logos across all seven app screens is the next wave, reported first per the brief. Evidence: CODE + AUTOMATED TEST (theme switch + no-hard-coded-colour; logo family distinct + accent + spark — 6 tests; full suite 12333 pass; typecheck 0; build 0). Look/feel and the character judgement are HUMAN-EYE, awaiting Leo. On-device is PHYSICAL_DEVICE — NOT claimed.'

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
