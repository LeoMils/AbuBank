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
const BUILD_VERSION = '0.248.0-input-oracle'
const BUILD_LABEL = 'AbuBank 0.248.0 — P0 INPUT ORACLE: a misheard name no longer returns not_found. On the device people_lookup for "גילעד" returned not_found — STT added a yud, the dataset spells "גלעד", and the family tests fed names spelled exactly as stored (input-side circularity, the Gilad problem again on the input side). Fix (resolver): a matres-lectionis SKELETON drops the optional yud/vav STT freely adds or drops and resolves the mangled name; resolvePersonId now indexes and tries BOTH the true base form and the prefix-stripped form, so names that START with a prefix letter (לאו, מור, מרתה) match by their true spelling and prefixed forms still reduce onto them; the reach path returns AMBIGUOUS (asks which one, naming a deceased match too) instead of not_found or a wrong edit-distance guess. Generator: sttVariants() produces realistic STT variants (yud/vav insert and drop, final forms, sibilant/guttural swaps, prefix, spacing) with no hand-written lists. Standing Layer-1 rule enforced by inputOracle.test: no test feeds a value verbatim from the source it validates against; every one of the 65 names is run through generated variants; not_found=0 and wrong=0 on the recoverable set (739 variants), with genuinely-indistinguishable variants (empty skeleton, or a skeleton belonging to another person) excluded and documented. Gates: typecheck 0, full suite 12,771 passed, build ok. Prior: family never-null + dead anti-preamble text (v0.247).'

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
