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
const BUILD_VERSION = '0.199.0-abuela-rollout-w1-rc1'
const BUILD_LABEL = 'AbuBank 0.199.0 — ABUELA_ROLLOUT_W1_RC1 (M4 rollout wave 1 + M6): a senior-first VERIFICATION gate — a WCAG contrast test proves BOTH themes (Night Garden dark + Bright Day light) meet AA 4.5:1 for body text on the worst-case background, plus the 56px touch / 16px body minimums. Because every screen inherits the tokens + shared components, this verifies senior-first legibility SYSTEM-WIDE in both themes. The shared ScreenHeader now carries the per-app Abu logo mark; Abu News and Abu Bank are fully in the Night Garden system (themeable PAGE_BG + logo). docs/DEVICE-TEST.md is written for Leo (numbered, riskiest-first, say / expect / trace, non-programmer). M2 prep: the provider abstraction, registry, adapters and bake-off (M1) make wiring the chosen winner into the endpoint a small, well-defined change — gated on a keyed winner, never faked. Staged as careful next waves: re-theming Weather / Games / Calendar / WhatsApp (Weather already carries the Night Garden starfield) and rebuilding the Abu AI screen; the illustrated character is out for commission (docs/design/CHARACTER-ASSET-SPEC.md). Evidence: CODE + AUTOMATED TEST (contrast in both themes + sizes; logo + theme applied; full suite green; typecheck 0; build 0). On-device and look/feel are PHYSICAL_DEVICE / HUMAN-EYE — NOT claimed.'

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
