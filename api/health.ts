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
const BUILD_VERSION = '0.169.0-canonical-ios-container-guard-rc'
const BUILD_LABEL = 'AbuBank — CANONICAL_IOS_CONTAINER_GUARD (session 46). Acts on the forensic result (no in-process phones>0->0 transition; the only device hypothesis is Safari-tab vs installed-PWA storage-jar isolation) by pinning ONE canonical iPhone entry: the installed Home-Screen PWA on abu-ela-rc.vercel.app. New iosContainer.ts detects the environment privacy-safely (host, display-mode, navigator.standalone, iOS, locally-generated container id, last-save container id, contact/phone counts, high-water) and classifies CANONICAL_PWA / SAFARI_BROWSER / WRONG_HOST / UNKNOWN_IOS_CONTAINER / POSSIBLE_EXTERNAL_STORAGE_LOSS / NON_IOS_OK. On an iOS Safari tab (wrong jar) normal import/save is BLOCKED with prominent Home-Screen-icon guidance (container-guard-banner) — never a silent import into a jar the PWA cannot read; desktop/operator automation is NOT gated. Every committed save stamps the container id, so a same-jar eviction (POSSIBLE_EXTERNAL_STORAGE_LOSS) is distinguished from a container mismatch. The Operator receipt shows the full container condition + recommended action; the Board focused-contact shows the honest container message, never "not configured" for a container/storage cause. Recovery stays export->import (no auto cross-jar copy, no cloud). Honest limit: a fresh isolated jar cannot see another jar, so a never-saved PWA is indistinguishable from a first run — not overclaimed. Evidence: CODE + TEST (iosContainer 14/14 incl. mutation cases; full suite 0 new regressions) + PREVIEW (two-container e2e). DEVICE: one confirmation only — open from the Home-Screen icon and copy the container receipt. Builds on 0.168.0.'

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
