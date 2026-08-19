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
import { authEnforced } from './_session'

export const config = { runtime: 'edge' }

interface HealthResponse {
  ok: boolean
  buildVersion: string
  buildLabel: string
  serverTime: string
  realtimeModel: string
  /** Whether the billable endpoints enforce a server-verified session (LOUD signal:
   *  false ⇒ AUTH_SIGNING_SECRET not provisioned ⇒ NO_LOGIN_PWA_AUTH_POLICY not closed). */
  authEnforced: boolean
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
const BUILD_VERSION = '0.293.0-auth'
const BUILD_LABEL = 'AbuBank 0.293.0 — SERVER-VERIFIED AUTH (supersedes 0.292.1-entry). Closes the no-login exposure: the billable Abu APIs (chat/tts/stt/online/news/realtime-token) now REQUIRE a server-verified session — an unauthenticated caller gets 401 with ZERO provider call, so the internet can no longer spend the owner keys. Real WebAuthn/passkey: server-generated challenge → navigator.credentials → SimpleWebAuthn verifies challenge/origin/RP/signature/UV → HttpOnly session cookie. Enrollment is owner-bootstrapped (ENROLLMENT_SECRET; no self-enrol). Stateless HMAC-signed session + device-cert cookies (no shared KV). PIN stays the LOCAL fallback (PIN-only unlock grants no server session — server stays protected). Entry UX unchanged: intro → Face ID → app. RESIDUAL: private family data still bundled in public client assets (materially larger migration — reported, not closed). Device-check pending: real Face ID passkey ceremony is PHYSICAL_DEVICE. Do NOT merge (3 old keys await owner revocation).'

export default function handler(_req: Request): Response {
  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env) ?? {}
  const openaiPresent = typeof env.OPENAI_API_KEY === 'string' && env.OPENAI_API_KEY.length > 0
  const body: HealthResponse = {
    ok: openaiPresent,
    buildVersion: BUILD_VERSION,
    buildLabel: BUILD_LABEL,
    serverTime: new Date().toISOString(),
    realtimeModel: REALTIME_MODEL,
    authEnforced: authEnforced(),
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
