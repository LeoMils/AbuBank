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
const BUILD_VERSION = '0.136.0-ledger-soft-confirm'
const BUILD_LABEL = 'AbuBank — LEDGER_SOFT_CONFIRM (Cycle 56 — REVOLUTION mandate, session 6: the soft-confirm door). Completed the three-door conversation intake. A plainly-stated family fact with NO "תזכרי" ("רותי היא אשתו של דני") is caught ONLY in the general path (every real domain wins first), replies ONE Hebrew confirmation prompt ("לרשום שזה נכון? … כן/לא"), and sets pendingLedgerChange on RuntimeState WITHOUT writing. The NEXT "כן" commits it through THE LAWS gate (LedgerService.writeFact) and it becomes answerable; "לא" abandons it ("בסדר, לא רשמתי"); any other turn drops the pending fact. The pending-confirm resolver runs BEFORE the conversation engine and is guarded (createState idle + no pendingReminder + pendingLedgerChange set), so it can NEVER hijack the calendar "כן" — a calendar create still saves normally. RED-first controller round-trip: state fact → prompt → "כן" → in the ledger AND answerable ("מי אשתו של דני" → "דני נשוי לרותי"); "לא" writes nothing; calendar confirm untouched. Reuses familyLaws/ledgerService/ledgerRuntime/conversationIntake — no parallel path. Evidence: CODE — ledgerSoftConfirm 3/3, truth + AbuAI 4545 pass, full suite 11101 pass / 2 todo, typecheck + build; no regressions. PREVIEW: fresh deploy + re-run e2e. Remaining (next): birthdays→calendar write, one-tap upload diff UI, ledger view surface. Builds on 0.135.0.'

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
