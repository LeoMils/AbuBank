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
const BUILD_VERSION = '0.221.0-companion-behaviour-and-safety'
const BUILD_LABEL = 'AbuBank 0.221.0 — P5: Abu BEHAVES like a friend, and is safe. Built first, because it is safety not polish: a prominent DISTRESS protocol that overrides every other rule — if Martita says she fell, is in pain, unwell, frightened or that something is wrong, Abu stays calm, does not diagnose or minimise, immediately prepares a call to Leo (phone_call), and for a real emergency (chest pain, a fall, trouble breathing) also tells her clearly to call מד״א 101 herself, never claims a call was made, and STAYS WITH HER — grounding her (where are you, can you sit down, is the door open) until she is calm or someone is there. A standing safety guard (companionSafety.guard.test.ts) fails the build if the distress protocol or the invariants regress: residence is not live location, no medical or financial details kept or advised, she draws Martita toward real family rather than into dependency, and she never claims an action a tool has not confirmed. Plus the friend behaviours: she brings things up unprompted (rate-limited, never nagging), connects sideways (food to gefilte fish, Tuesday is Mor day, wine is never red), is warm without performance, softens into a gentle mode when Martita repeats herself or is confused, and after two failed understandings offers a concrete action instead of a third rephrase. Second pass added the grounding cue to the distress protocol after a self-review found it escalated before steadying her. Evidence: CODE + AUTOMATED TEST (deterministic guards; the real-model behaviour is P9). typecheck + full suite (12,653) + build. Note: the brief asked for specialist agents, but the checked-in V4 rule mandates one foreground writer with no subagents, so I stayed the sole writer and self-reviewed. Prior: Companion Brain P0-P3 (v0.220). Next: P6 actions, P7 online depth, P8 reliability, P9 companion suite.'

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
