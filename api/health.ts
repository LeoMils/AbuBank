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
const BUILD_VERSION = '0.168.0-storage-taxonomy-clone-migrate-genome-rc'
const BUILD_LABEL = 'AbuBank — STORAGE_TAXONOMY + CLONE_MIGRATE + FAILURE_GENOME (session 44). Closes more of the automatable QA residue. GATE 8: contactStorageHealth.ts classifies WHY contacts are missing (CONTACT_NOT_CONFIGURED / SAVE_INTERRUPTED / RECOVERY_PENDING / DATA_CORRUPT / STORAGE_UNAVAILABLE / QUOTA_EXCEEDED / EXTERNAL_STORAGE_LOSS / WRONG_ORIGIN / USER_DELETION) using a privacy-safe high-water marker; the Board focused-contact and the operator receipt now show an HONEST message and NEVER say "not configured" for a storage/recovery failure. Saves record the high-water + in-flight markers so an interrupted save is detectable on reopen. GATE 4/D5: migrateContactsOnClone runs any migration on a CLONE and commits atomically only if schema + phone-preservation + checksum pass; strip/drop/throw/invalid all abort with the prior revision byte-for-byte intact (cloneMigration.test.ts). Failure Genome (failure-genome.json): 20 automatable failures mapped to regression + mutation proof + deployed replay, replayed before every RC. Meta-QA (meta-qa.json): blind-spot + assumption registers, mutation certification (every critical invariant has a red mutant), test-path authenticity audit, QA-system fault-injection, and a bug-coverage matrix. Evidence: CODE + TEST (Gate 8 11/11, D5 6/6; full suite only 5 pre-existing date/replay failures, 0 new). DEVICE: iOS storage-partition confirmation remains. Automatable residue: real A->B->C multi-deploy + real-provider comms matrix + enlarged-text reachability. Builds on 0.167.0.'

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
