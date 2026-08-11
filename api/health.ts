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
const BUILD_VERSION = '0.196.0-one-people-store-rc1'
const BUILD_LABEL = 'AbuBank 0.196.0 — ONE_PEOPLE_STORE_RC1 (M3): family relationships are derived correctly in real Hebrew from ONE canonical people model. New src/services/people/: peopleModel (reads the single source knowledge/family_data.json → direct edges parents/children/spouses/formerSpouses/partners/cohabits, gender only where known; a partner implies nothing about parenthood), kinship (DERIVES at query time, never stores: אח/אחות · דוד/דודה · אחיין/אחיינית · בן דוד/בת דודה · סבא/סבתא · נכד/נכדה · נין/נינה · גיס/גיסה · חתן/כלה · חם/חמות · מחותנים, gendered), and ONE people_lookup tool (who / relationship / relatives / contact by name OR by relationship; numbers resolve at the UI, never in the model). The three named on-device failures now pass: Leo=דוד of Mor\'s children, Gilad=גיס of Eili, Yarden=כלה of Rafi. A Hebrew-error validator (scripts/validate-people.ts) is wired into prebuild — a broken family file never builds. Instruction size if family moves from the prompt to people_lookup: 12978 → 9587 chars (−26%); the actual prompt removal, full retirement of resolve_contact, and generating the legacy stores (family_graph.json / abu-family.md) FROM the one source are staged (they touch the embedded-family tests). Evidence: CODE + AUTOMATED TEST (kinship engine incl. every derived type + the 3 named failures + 8 invariants; people_lookup; live-tool wiring — 59 tests; full suite 12327 pass; typecheck 0; build 0; validate:people green). On-device kinship in live speech is PHYSICAL_DEVICE — NOT claimed.'

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
