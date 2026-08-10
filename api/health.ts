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
const BUILD_VERSION = '0.192.0-abuela-hub-ia-rc1'
const BUILD_LABEL = 'AbuBank 0.192.0 — ABUELA_HUB_IA_RC1 (Part 1 of the Abu-ela restructure): Home is now a HUB listing the Abu family of apps and nothing else. The nine Kfar-Saba services (מזרחי, דואר, MAX, מים, חשמל, ארנונה, HOT, פרטנר, yes) moved intact into a new Abu Bank app (Screen.AbuBank) with an always-visible BackButton to the hub — they are no longer the front door. The hub shows seven apps in order — Abu AI, Abu Bank, Abu יומן, Abu WhatsApp, Abu Games, Abu מזג אוויר, Abu News — each a consistent glass tile (Phosphor icon + accent) on the existing design tokens (starts Part 4). New Abu News app (Screen.AbuNews) is an HONEST shell — no fabricated stories — until Part 3 wires grounded retrieval. HARD CONSTRAINT KEPT: Abu AI opens the LIVE path (openLiveAbu → __abubankOpenLive), never the legacy AbuAI screen; routing is pure data in hub.ts, locked by hub.test.ts and the updated liveEntryPoint guard. Every app returns to the hub via BackButton. Evidence: CODE + AUTOMATED TEST (hub routing/cutover, Abu Bank services-moved; full suite green; typecheck 0; build 0). Parts 2–5 are staged — see report; wiring online into the live honesty guard is deferred as a reviewed change. On-device look/feel is PHYSICAL_DEVICE — NOT claimed.'

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
