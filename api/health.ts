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
const BUILD_VERSION = '0.215.0-one-retrieval-path'
const BUILD_LABEL = 'AbuBank 0.215.0 — FIX 1+2: ONE retrieval path for all people (the "who is Susi → not_found while Elsi answered fully" smoking gun). Root cause: the extended family was role-only and never wired into the derived kinship graph — Martita had NO spouse edge to Papi, no parents, no siblings, and the entire Papi side was disconnected — so whoIs worked (via role) but relationshipBetween/relativesByKind returned empty for a whole tier. Fix (fix the graph, do not keep a second tier): the source of truth now carries the missing structural edges (Martita↔Papi spouse; Dora+Jacobo as her parents with Luis+Bobby as siblings; Jose as the father of Papi with Tavela + brothers as his siblings; children edges hanging Jorge/Fabi/Martin, Rosita/Lior/Yoav/Ron, the Vancouver sons of Tavela, the son of Bobby off the graph), so EVERY person now derives by name, alias, and relationship on one path. FIX 2: when no single kinship term exists (the husband of a niece, a grand-nephew), a bounded BFS DESCRIBES THE PATH in Hebrew ("גלעד בעל של אופיר, שהיא בת של מור, שהיא אחות של לאו") instead of saying "no relation". Added friendsOf for "my friends", and סוסי as an STT-variant alias of Susi. Proven by a new reachability harness that queries every one of the 68 people by name AND relationship: BEFORE 31 failing, AFTER 0 (215/215). Full suite 12,618 green (the graph change destabilised nothing). Evidence: CODE + AUTOMATED TEST. Still open (separate subsystems, not in this build): FIX 3 history retrieval, FIX 4 conversation_already_has_active_response crash, FIX 5 tool timeouts, FIX 6 news/cinema depth, FIX 7 the instantAcknowledgement preamble seed, FIX 8 audio.'

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
