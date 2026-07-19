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
const BUILD_VERSION = '0.138.0-person-chapters'
const BUILD_LABEL = 'AbuBank — PERSON_CHAPTERS (Cycle 58 — LEDGER EXPANSION v3, session 2: full-person chapters). Extended the ledger from relations to a full CHAPTER per person. familyLaws gained a PersonFact { kind, value, source, at } model (residence/work/hobby/health/event/story/preference — every fact carries PROVENANCE + DATE) and an addFact op gated by THE LAWS (person must exist, no empty fact); the curator supersedes a single-valued fact (a MOVED residence — latest wins, no fact deleted). CONVERSATION: extractChange now parses residence ("דני גר ב…"), work ("דני עובד ב…") and preference ("דני אוהב …"); first-person ("אני אוהבת יין") stays Martita own preference-memory. The explicit "תזכרי ש<fact>" write moved BEFORE the memory/reminder split so a chapter fact is never mis-read as a reminder; every write still passes THE LAWS gate. READ: ledgerChapterAnswer answers a PERSONAL question from the chapter — "איפה גר X" / "איפה עובד X" / "מה X אוהב" / "מה את יודעת על X" — before punting to the LLM. The chapter renders into the canonical Hebrew ledger view with provenance. RED-first controller round-trip: state a personal fact → written (gated, dated) → Abu answers it from the chapter. Reuses familyLaws/ledgerService/ledgerRuntime/conversationIntake/ledgerCurator — no parallel path. Evidence: CODE — personChapter 5/5, truth 42, AbuAI + eval 8921 pass, full suite 11120 pass / 2 todo, typecheck + build; no regressions. PREVIEW: fresh deploy + re-run e2e. Deferred (infra-gated): cloud-canonical store, real email/cron; and the תעודת המשפחה view + one-tap upload UI. Builds on 0.137.0.'

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
