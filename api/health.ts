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
import { authConfigured, authEnforced, isProduction, productionMisconfigured } from './_session'
import { distributedStoreAvailable, replayProtectionSatisfied, replayStoreKind } from './_replayStore'

export const config = { runtime: 'edge' }

interface HealthResponse {
  ok: boolean
  buildVersion: string
  buildLabel: string
  serverTime: string
  realtimeModel: string
  /** Billable endpoints require a verified session OR are denied (fail-closed in prod). */
  authEnforced: boolean
  /** Both AUTH_SIGNING_SECRET + ENROLLMENT_SECRET present. */
  authConfigured: boolean
  /** RED flag: a PRODUCTION deployment missing the secrets (must not ship). */
  productionMisconfigured: boolean
  /** 'kv' = distributed single-use replay protection; 'memory' = per-instance best-effort. */
  replayStore: 'kv' | 'memory'
  /** True only when a durable cross-instance store backs single-use (GLOBAL guarantee). */
  challengeSingleUseGlobal: boolean
  /** True when replay protection is adequate for this deployment (prod requires distributed). */
  replayProtectionSatisfied: boolean
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
const BUILD_VERSION = '0.294.0-privauth'
const BUILD_LABEL = 'AbuBank 0.294.0 — REPLAY-HARDENED AUTH + PRIVATE FAMILY DATA MOVED SERVER-SIDE (supersedes 0.293.0-auth). REPLAY: WebAuthn challenges are now SINGLE-USE (server-side nonce consumption in api/_replayStore) + monotonic-counter baseline held server-side (device-cert rollback cannot lower it); the exact "replay A+C within TTL" attack is DENIED (challenge TTL tightened to 120s). Distributed single-use auto-upgrades to KV when KV_REST_API_URL/TOKEN are provisioned (owner, free-tier); otherwise per-instance (denies the immediate replay). FAIL-CLOSED: a PRODUCTION deploy missing AUTH_SIGNING_SECRET or ENROLLMENT_SECRET now blocks the build AND denies billable requests (503) — never open; /api/health exposes authEnforced/authConfigured/productionMisconfigured/replayStore. PRIVATE DATA: knowledge/family_data.json is no longer bundled — it is served only from the authenticated /api/family (Cache-Control private,no-store; SW never caches it) and hydrated at boot (+device-local IndexedDB offline). RESIDUAL: the WhatsApp contacts-seed (familyContacts.private) is a SEPARATE bundled name source — its migration is documented, not done. Device-check pending: real Face ID ceremony is PHYSICAL_DEVICE. Do NOT merge.'

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
    authConfigured: authConfigured(),
    productionMisconfigured: productionMisconfigured(),
    replayStore: replayStoreKind(),
    challengeSingleUseGlobal: distributedStoreAvailable(),
    replayProtectionSatisfied: replayProtectionSatisfied(isProduction()),
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
