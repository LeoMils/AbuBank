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
const BUILD_VERSION = '0.146.0-ledger-intake-width'
const BUILD_LABEL = 'AbuBank — LEDGER_INTAKE_WIDTH (INTAKE REBUILD, session 7 · P5). Explicit-remember ("תזכרי ש…") now covers EVERY chapter kind, not just residence/work/preference: a new explicit-only extractor (extractExplicitFact) adds education (למד/לומד/סיים תואר), hobby (מנגן/מצייר/רוקד/אוסף/משחק), event (התחתן/התארס/טס ל/טייל ב), and a GENERIC STORY catch-all so any stated fact about a KNOWN person is stored (the whole sentence, nothing lost) instead of "לא יכולה לזכור". THE LAWS still gate every write (unknown person → refused honestly). Privacy holds: medical + financial + phone content is declined and NEVER stored, even on explicit remember; first-person ("אני…") stays Martita own preference-memory. Crucially the WIDTH is explicit-only — the shared soft-confirm extractChange is UNCHANGED, so no conversational/eval drift. Added the education FactKind. Evidence: CODE — ledgerWidth 13/13 + FULL suite green / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P6 no-fabrication guard → P7 correction-verify → P8 toast → verification regime. Builds on 0.145.0.'

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
