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
const BUILD_VERSION = '0.126.0-crosslang-supersede'
const BUILD_LABEL = 'AbuBank — CROSSLANG_SUPERSEDE (Cycle 46 — fix the single-session cross-language contamination surfaced by the browser E2E vs preview). First divergence: with a Hebrew create left on a pending נכון?, a Spanish create (agendá una reunión con Gabi mañana a las tres) rendered a Spanish confirm for Gabi BUT the createState draft stayed on the stale Hebrew person (גלעד) — because classifySignalV2 new-create detection was Hebrew-only, so the Spanish create was misread as a side_question and side_keep restored the stale draft; the next dale, agendalo then SAVED גלעד in Hebrew (confirm did not match the read-back). ROOT FIX (conversationEngineV2.ts): a NON-Hebrew genuine create (isCreateIntent, which already covers Rioplatense agendá/anotá/programá + schedule clue, and not a draft-edit) now classifies as new_create → replace, so the pending draft is superseded and the confirm saves the read-back person. Scoped to non-Hebrew input so Hebrew incremental collecting is untouched (the Hebrew full-create path already worked). RED-first: crossLanguageDraftSupersession.test reproduced the save-of-stale-draft before the fix (He→Es), with the Es→He direction already green. Evidence: CODE — crossLanguageDraftSupersession 2/2, conversation/calendar/parity suites green; full suite + typecheck + build. PREVIEW: fresh deploy + e2e/preview-parity single-session supersession re-run vs the deployed build. Voice/Realtime untouched. Builds on 0.125.0.'

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
