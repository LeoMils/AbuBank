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
const BUILD_VERSION = '0.195.0-abuela-design-system-rc1'
const BUILD_LABEL = 'AbuBank 0.195.0 — ABUELA_DESIGN_SYSTEM_RC1 (Part 4 foundation): the design system made real and SHARED — not one-off styling per screen. Extended src/design with a spacing/radius/touch scale (space.ts: space 4→48, radius sm→pill, MIN_TOUCH=56, MIN_BODY_PX=16) on top of the existing colour + Heebo type scale, and added shared senior-first components in src/components/ui: ScreenHeader (BackButton + "Abu <name>" brand title), Card (warm glass, pressable ≥56px, per-app accent) and PrimaryButton (≥56px, large high-contrast type). Applied to the reference app Abu News (fully in the system) and Abu Bank (shared header); each app keeps its own accent within one system. Documented in docs/design-system.md (principles, tokens, components, per-app accents, adoption + rollout status). Per the brief this shows the system on the hub apps FIRST and STOPS for report — the Home brand hero and the AI / Calendar / WhatsApp / Games / Weather screens are NOT yet migrated. Evidence: CODE + AUTOMATED TEST (senior-first minimums ≥56/≥16, component render — 23 tests; full suite green; typecheck 0; build 0). "Looks world-class" is a HUMAN-EYE / PHYSICAL_DEVICE judgment — NOT claimed.'

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
