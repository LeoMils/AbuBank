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
const BUILD_VERSION = '0.139.0-family-record-screen'
const BUILD_LABEL = 'AbuBank — FAMILY_RECORD_SCREEN (Cycle 59 — LEDGER EXPANSION v3, session 3: the תעודת המשפחה screen). Shipped the senior-safe Family Record screen (Settings → תעודת המשפחה). It renders the canonical Hebrew ledger (renderLedgerHebrew, with per-fact provenance + change log), and gives Leo a paste-free-text box: each pasted line runs through extractChange (parseFreeText) into a one-line accept/reject DIFF, and every recognised fact is COMMITTED ON TAP through LedgerService.writeFact — i.e. THE LAWS gate (a poison line like "אופיר היא אשתו של רפי" is refused with a Hebrew reason and nothing is stored). Plus an EXPORT-BACKUP button (downloads the full change-log + rendered ledger as JSON) and an UNDO-last-change button. Reuses familyLaws/ledgerService/ledgerRuntime/conversationIntake/ledgerCurator/ledgerView — no parallel path; the screen is pure UI over the existing engine. RED-first: familyRecordLogic (parseFreeText + commitProposal, poison-refused) 2/2, screen render 1/1. Evidence: CODE — FamilyRecord 3/3, full suite green, typecheck + build. PREVIEW: fresh deploy + re-run e2e. This is the FINAL pre-verification cycle — cloud storage / email / other expansion intentionally NOT started; Leo verification round + voice phase come next. Builds on 0.138.0.'

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
