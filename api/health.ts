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
const BUILD_VERSION = '0.134.0-family-ledger'
const BUILD_LABEL = 'AbuBank — FAMILY_LEDGER (Cycle 54 — REVOLUTION mandate, session 4: the living ledger core). Built the product-facing Truth-Loop foundation on top of THE LAWS. LedgerService (src/truth/ledgerService.ts): ONE canonical state where the ledger IS a pure function of (seed, change-log) — file-as-view. EVERY write, from any source, goes through familyLaws.applyChange (THE LAWS gate) so a contradiction can never enter; a rejected fact leaves NO log entry (poison never stores). Every change is one log line and UNDOABLE (pop the log, replay from the seed); state persists across reload (localLedgerStore). renderLedgerHebrew (ledgerView.ts) regenerates the canonical human-readable Hebrew ledger from state. CONVERSATION INTAKE (conversationIntake.ts) — three doors: explicit "תזכרי ש…" writes immediately; a plainly-stated fact ("X היא אשתו של Y") gets ONE soft confirmation (pending change + Hebrew prompt); a vague hint ("אולי", "נראה לי") NEVER writes. extractChange parses spouse/parent/sibling/birthdate into a gated Change — even an explicit poisoning fact is still refused at the gate. Manual upload returns a one-line diff per fact (reuses applyBatch). Birthdays propose a yearly calendar entry on approval. Evidence: CODE — ledgerService 12/12, truth suite 28, full suite 11095 pass / 2 todo, typecheck + build. NOT yet wired into the live conversation runtime / one-tap UI (next session). Reuses familyLaws — no parallel path. Builds on 0.133.0.'

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
