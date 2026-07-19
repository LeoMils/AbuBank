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
const BUILD_VERSION = '0.137.0-nightly-autopilot'
const BUILD_LABEL = 'AbuBank — NIGHTLY_AUTOPILOT (Cycle 57 — LEDGER EXPANSION v3, session 1: the autopilot core). Built the invisible maintenance chain (Constitution §3/§4), CODE-provable, reusing the existing engines. LEDGER CURATOR (src/truth/ledgerCurator.ts + LedgerService.curate/undoCuration): dedupe identical facts, supersede a corrected value (latest wins, in place), reorder chronologically — NEVER deletes a fact; each substantive change is one Hebrew line and the whole curation is UNDOABLE. NIGHTLY CHAIN (src/eval/nightlyAutopilot.ts): runs the duel/guard corpus + the flight-recorder analyzer (weaknessMap → archetypes) + the curator, emits ONE Hebrew status line (🟢 הכל תקין / 🟠 נמצאו N דברים לתיקון) and, when items exist, a ready-made fix-the-queue prompt for Claude Code. LEO-ONLY NOTIFICATION (src/eval/notify.ts): email via raw fetch to Resend when RESEND_API_KEY + LEDGER_RECIPIENT exist, else the honest Leo-only status page — NOTHING is ever Martita-facing. SERVER CRON (api/cron/nightly.ts, nodejs runtime, + vercel.json crons 03:00) runs the server-safe curator and returns the status page. HONEST INFRA LIMITS (proven, not hidden): NO storage backend (KV/Postgres/Blob), NO email provider, NO deps addable (package.json gated) are provisioned here — so cloud-canonical persistence, real email, and guaranteed cron firing are DEFERRED; the endpoint + fallbacks are built and documented. Evidence: CODE — ledgerCurator 3/3, nightlyAutopilot 5/5, notify 4/4, cronNightly 2/2, full suite 11115 pass / 2 todo, typecheck + build. Deferred: cloud-canonical ledger store, full-person chapters, one-tap upload UI. Builds on 0.136.0.'

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
