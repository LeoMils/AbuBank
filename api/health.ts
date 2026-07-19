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
const BUILD_VERSION = '0.135.0-ledger-wiring'
const BUILD_LABEL = 'AbuBank — LEDGER_WIRING (Cycle 55 — REVOLUTION mandate, session 5: the ledger goes live in conversation). Wired the ledger CORE into the AbuAI runtime through THE LAWS gate. WRITE: an explicit "תזכרי ש<family fact>" (e.g. תזכרי שדני נשוי לרותי) is intercepted in the memory-save path and written to the ledger via LedgerService.writeFact (auto-creating any new relative, atomically) — a contradiction is REFUSED at the gate ("לא רשמתי — <reason>") and never stores; a normal preference "תזכרי ש…" is untouched and still goes to preference-memory. READ: the family engine now reads FROM the ledger — a conversation-added relation the static graph is silent about ("מי אשתו של דני" → "דני נשוי לרותי") is answered from the ledger, using the RAW input so possessive pronouns are not rewritten. Ledger-fills-the-gap is safe because the LAWS gate guarantees a ledger fact can never contradict the graph. RED-first controller round-trip: state a fact → it is written (gated) → answerable; a bigamy poison against the real graph is refused. Reuses familyLaws/ledgerService/conversationIntake — no parallel path. Evidence: CODE — ledgerWiring 3/3, truth suite, AbuAI 4511 pass, full suite 11098 pass / 2 todo, typecheck + build; no regressions. PREVIEW: fresh deploy + re-run e2e. Remaining (next): soft-confirm flow (pending-change state), one-tap upload diff UI, birthdays→calendar write. Builds on 0.134.0.'

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
