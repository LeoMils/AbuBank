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
const BUILD_VERSION = '0.166.0-qa-ownership-and-storage-diag-rc'
const BUILD_LABEL = 'AbuBank — QA_OWNERSHIP + STORAGE_DIAG (session 42). Claude Code now owns the persistence lifecycle QA that was being handed to Leo. A PERSISTENT-PROFILE lab (e2e/persistence-lifecycle.spec.ts) drives the REAL deployed Contact Management import, then TERMINATES (closes the browser profile) and REOPENS the SAME on-disk profile x5 on the stable origin — in BOTH Chromium AND WebKit. Result: phones SURVIVE every reopen, the Family Board Call button stays live, and NO JSON re-import is needed. So the app storage code does not lose data on reopen in either engine; the 100%-reproducible device loss (seed names+photos survive, phones gone) is consistent with an iOS standalone-PWA-vs-Safari-tab storage PARTITION or ITP eviction — not the reconcile logic. Per the mission rule, NO storage policy changed until the exact device transition is proven. To make that a ONE-capture confirmation, the boot trace now records a privacy-safe environment fingerprint (display-mode, iOS standalone flag, storage.persisted(), usage/quota) and a gesture-time navigator.storage.persist() request on every import/save (a durability hint, not a policy change). Gate 0 artifacts added: docs/engineering-os/qa/{mission,qa-ownership,evidence}.json classify every acceptance item CLAUDE_MUST_PROVE vs PHYSICAL_IPHONE_ONLY. Evidence: CODE + TEST + PREVIEW (2-engine persistent-profile lab). DEVICE: one enriched-trace capture will confirm the storage-partition hypothesis. Builds on 0.165.0.'

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
