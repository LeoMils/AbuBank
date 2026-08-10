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
const BUILD_VERSION = '0.191.0-live-name-pronunciation-spanish-rc1'
const BUILD_LABEL = 'AbuBank 0.191.0 — LIVE_NAME_PRONUNCIATION_SPANISH_RC1: the pronunciation rule reduced to its simplest form — every family name is pronounced by READING ITS LATIN SPELLING AS SPANISH (pure Spanish vowel values, Spanish stress; no English vowel shifts, no English stress). knowledge/family_data.json now stores each person’s pronunciation as { es: <latin spelling> } for 16 people (leo, mor, rafi, ofir, gilad, anabel, ari, adar, eilon, ilay, yarden, adi, noam, yael, martita, papi); buildPronunciationGuidance projects them into the "# How to Say Names" section with NO invented respellings (replaces the old free-text "LEH-oh"). DATA CORRECTIONS: עדי/Adi and נועם/Noam are MALE — corrected in abu-family.md (were gender-ambiguous "ילד/ה" and listed under "unknown"); family_graph.json + genderMatrix already had them male (verified, unchanged). ALIASES: eilon (canonical Ayalon/איילון) and ilay (canonical Eili/עילי) added so both spellings resolve; canonical Hebrew spellings unchanged. victor = Papi’s given name and abu/marta are Martita nicknames — covered by the global Spanish rule. Evidence: CODE + AUTOMATED TEST (pronunciation data + rule, Adi/Noam-male in prose + live instructions, eilon/ilay resolution; full suite green; typecheck 0; build 0). On-device Spanish pronunciation is PHYSICAL_DEVICE — NOT claimed.'

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
