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
const BUILD_VERSION = '0.131.0-constitution-foundation'
const BUILD_LABEL = 'AbuBank — CONSTITUTION_FOUNDATION (Cycle 51 — REVOLUTION mandate, session 1: the two keystones). Built the Truth-Loop and Learning-Loop keystones as pure, CODE-provable mechanisms. (1) THE LAWS (src/truth/familyLaws.ts) — a family-universe invariant suite enforced at a single WRITE GATE (applyChange): relation symmetry BY CONSTRUCTION (spouse↔spouse, parent↔child), no parenthood cycles (L2), parent-older-than-child (L4), monogamy + incest guard (L7), siblings-share-parents (L3), one-identity/alias quarantine (L5), ages-from-birthdate only (L6), no self-relation (L8). A contradiction can no longer ENTER — it is rejected at the gate with a one-line Hebrew reason, and a rejected write leaves the ledger byte-for-byte unchanged. applyBatch returns a one-line diff per fact for a manual upload. Seeded from the REAL graph (ledgerSeed). (2) METAMORPHIC MIRROR SUITE (src/truth/mirrorSuite.ts) — 1380 oracle-free consistency checks over the real relation engine (inverse-existence + paraphrase-alias, He+Es), plus a structural spouse-symmetry mirror. PROOFS delivered: (a) planted contradiction REJECTED at the gate; (b) 1000+ mirrors pass AND a planted asymmetry caught by mirrors alone; (e) poisoning never stores; (f) manual upload conflict surfaces a one-line diff. Evidence: CODE — familyLaws 10/10, mirrorSuite 3/3 (1380 mirrors, 0 breaks), full suite + typecheck + build. Deferred to next sessions: (c) cross-domain archetype/weakness-map, (d) champion/challenger duel, ledger file + conversation write-path + birthdays→calendar. Builds on 0.130.0.'

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
