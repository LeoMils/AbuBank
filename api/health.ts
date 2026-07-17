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
const BUILD_VERSION = '0.113.0-referable-fix'
const BUILD_LABEL = 'AbuBank — REFERABLE_FIX (Intelligence, text-layer): PREVIEW-verified fix for calendar referability. A Playwright typed-script run on the deployed 0.112.0 preview caught "cancel it"/"where do I meet him" falling to the LLM: the pronoun was resolved to a person NAME across FOUR layers (UI resolvePronouns/resolveFollowUp/companion-continuity + the runtime normalizeInput), and feminine "אותה" mis-resolved to a stale female name ("ארי") ignoring the focused (male) event. Fixes: (1) the UI skips its pronoun/follow-up rewrite while a calendar event is in focus; (2) the runtime keeps a referential-pronoun turn RAW under a calendar focus so normalizeInput no longer mis-resolves it; (3) isFocusPropertyQuery also binds a property question that NAMES the focus person. Result: create→"where do I meet him"→"cancel it" is deterministic (~330ms), 13/13 on the live preview. Evidence: PREVIEW (Playwright on the deployed build) + CODE (calendarReferability regressions); full suite 10988 green; typecheck+build clean. Note: the 0.112.0 RUNTIME_OWNED/cogFocusRef edits were in DEAD code (live path is ExecutiveController→runFullTurn→runCognitiveTurn); the duplicate-handler removal stands. Voice/Realtime untouched. Builds on 0.112.0.'

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
