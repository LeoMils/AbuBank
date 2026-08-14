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
const BUILD_VERSION = '0.247.0-qa-m3-m1'
const BUILD_LABEL = 'AbuBank 0.247.0 — QA run Part 1: M3 (family never-null) closed, M1 (dead anti-preamble text) removed. M3: people_lookup returned relationToMartita null for Gilad (husband of Ofir, a granddaughter of Martita) so an 81-year-old had to name her own grandson-in-law — a circular-testing miss (the family tests asserted against the same dataset they read). Fix: added the grandchild_in_law term (one marriage hop) and wired describePathBetween as the whoIs fallback, so a connected entity is NEVER null; generated FAMILY_GROUND_TRUTH.md (65 people, 0 gaps, 0 not_found pairs) as the independent oracle; relationNeverNull.test asserts it at 100 percent (Layer 1, all entities). M1: deleted the Before-a-Tool-Call instruction (a device trace showed it disobeyed on every tool call — an instruction does not enforce silence; the real fix is structural in the session layer and device-verified); kept the instantAcknowledgement code-seed guard; did NOT flip LIVE_INTERRUPT_RESPONSE (it is false on purpose, an echo-truncation device fix). Instructions 13,855 to 13,221 chars; payload to 25,521. Audit in BRIEF_AUDIT.md; misses in QA_MISSES.md (2, each with a closing check); owner ear-only items in OWNER_CHECKLIST.md. Gates: typecheck 0, full suite 12,769 passed, build ok. Prior: first-wins price (v0.246).'

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
