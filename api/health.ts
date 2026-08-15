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
const BUILD_VERSION = '0.278.0-earonly'
const BUILD_LABEL = 'AbuBank 0.278.0 — GOLDEN-SESSION + ENFORCE (overnight): the repo now has its FIRST whole-conversation test. src/services/goldenSession.ts defines one scripted greeting-to-goodbye arc; the deterministic contract blocks the build, and scripts/golden/golden-session.mjs drives the REAL gpt-realtime through it. Top-line metric = does a full session complete with every turn correct and no dead ends. First real run 14/18 → after fixes 17/18. FOUND+FIXED (verified on the model): calendar stalled in "offer" mode (asked permission to prepare) → a concise instruction nudge makes prepare_calendar_event fire immediately (calendar create/confirm/readback all green now, under the 14000-char ratchet). FOUND+FIXED: the instrument tested a STALE 35k-char snapshot vs the real 13.9k instructions — sessionSnapshot.gen.test.ts now regenerates it every build (tested=deployed). ENFORCE (Part 4): the hard zero-FP output detectors (language purity, source-naming, literal-count) now REPAIR, not just observe. #2 message-routing explained (model does call people_lookup for unknown names, declines honestly). Open low-sev: online follow-up does not always re-ground (honest, not a dead end) — 17/18, NOT faked. Prior: TOOL-RESULT-HANG (v0.277). Do NOT merge (production serves Aug 5).'

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
