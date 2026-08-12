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
const BUILD_VERSION = '0.213.0-realtime-instructions-cap'
const BUILD_LABEL = 'AbuBank 0.213.0 — the device blocker string_above_max_length is fixed. Abu connected (gpt-realtime-2.1) and then died because the assembled session instructions had grown to 13,583 chars after the 68-person knowledge update, over the provider max-length for the instructions field, so the whole session.update was rejected. Fix (not blind truncation): the per-person pronunciation enumeration left the prompt and became one compact RULE (read every Latin spelling as Spanish — each spoken form now travels with people_lookup); knowledge/abu-knowledge.md was trimmed to lean personality (the enumerated Argentine friends, the red-wine family list and the pronunciation examples all live behind people_lookup); and duplicated operational prose between the persona and the frame was de-duplicated (the frame stays authoritative). Result: assembled instructions 13,583 → 9,478 chars; the ACTUAL sent string (instructions + today line) 9,656 — a 29% cut, under the last proven-working ~9,587 in spirit and well under the enforced cap. A build-time guard (assertInstructionsWithinLimit, REALTIME_INSTRUCTIONS_MAX = 10,000) now FAILS the build/import with the measured size if instructions ever exceed the cap, checked on the exact string buildSessionUpdate sends; a harness assertion covers the same shared string. The 10,000 ceiling is empirical (no published char cap found): 13,583 rejected on device, ~9,587 last known-good. Evidence: CODE + AUTOMATED TEST (liveInstructions + harness guards green; full suite + build). Not device-proven that voice now stays up — requires a physical reconnect on the deployed build.'

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
