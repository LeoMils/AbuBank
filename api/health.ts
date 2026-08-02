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
const BUILD_VERSION = '0.164.0-durable-persistence-and-luxury-contact-rc'
const BUILD_LABEL = 'AbuBank — DURABLE_PERSISTENCE + LUXURY_CONTACT (session 40). ROOT-CAUSE fix for the reported "phone numbers vanish on reopen" loop: the DurableStore startup reconcile was BACKEND-authoritative — on init it overwrote the synchronously-written localStorage mirror with the async IndexedDB copy, which on iOS often had NOT flushed the freshly-imported contacts and still held the number-less seed, so every reopen clobbered the good phones with the stale seed. Now localStorage is the LIVE authority: a PRESENT, structurally-valid (JSON-parseable) mirror WINS and is synced FORWARD into cache+backend; the backend only RECOVERS an evicted (empty) OR corrupt key. Import → leave → reopen now keeps the numbers. Failing-first regressions added in durableStore.test.ts (present-LS-not-clobbered, evicted-key-recovered); corruption-repair contract preserved. Second change: the focused-contact scene (tap a bubble → Call/WhatsApp) is redesigned into a full-bleed hero-photo "premium caller card" — the contact photo IS the screen, with a legibility scrim, warm gold hairline vignette, and a bottom glass panel holding the large name, relationship, and two 92px action buttons (WhatsApp + Call) plus the voice-compose pill in the thumb zone. Bigger picture, calmer, luxury tone; every testid preserved. Evidence: CODE + TEST — durable + contacts suites 54/54; DEVICE NOT PROVEN (reopen persistence + audibility require physical iPhone). Builds on 0.163.0.'

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
