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
const BUILD_VERSION = '0.209.0-device-trace-defects'
const BUILD_LABEL = 'AbuBank 0.209.0 — device-trace defects 1-6 + online diagnostic. (1) No preambles / no repeated openers: stripped the seeded filler menu from abu-persona.md, added a tool-agnostic guard (every owned tool speaks in the same turn) + harness assertions REPEATED_OPENING_PHRASE / ANNOUNCED_CHECK. (2) Audio truncation: turn_detection.interrupt_response=false so a self-hearing echo can never trigger a server-side cut of Abu after one word (create_response stays true). (3) people_lookup never guesses: a descriptive phrase resolves against its NAMED anchor ("הבת של רפי" -> Rafi child) or not_found, never a fuzzy substitute. (4) Mouth on iOS: a dead-analyser fallback animates the mouth from the speaking state (iOS reads the remote stream as a defined 0), plus a muted media-element sink to unblock the analyser. (5) Calendar: multiple named participants + any spoken name accepted even when not a contact (relationship phrases still refused). (6) Reaching the deceased (פפי) is a gentle decline, never a call card or a wrong relationship answer; still knowable via who/remember. Also: /api/abuai-online returns a non-secret diag (provider/keyPresent/reached/sourceCount/outcome) and the Tavily topic=news pin was removed. Evidence: CODE + AUTOMATED TEST across the suite. On-device audio/mouth remain PHYSICAL_DEVICE / HUMAN-EYE - not claimed.'

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
