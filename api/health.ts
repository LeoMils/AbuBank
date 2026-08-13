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
const BUILD_VERSION = '0.222.0-name-fuzzy-phonetic-match'
const BUILD_LABEL = 'AbuBank 0.222.0 — P8 (names): a misheard name now finds the right person before not_found. Names are the most important words in this product and the transcriber mishears them (סוזי as סוסי, a garbled friend). Added a SAFE fuzzy layer used ONLY after an exact match and a descriptive-phrase parse have both missed: a Hebrew phonetic normalisation that collapses the sounds the STT confuses (ז/שׁ/שׂ/צ all into ס, silent א/ע/ה dropped, ו/ב and כ/ק/ח and ט/ת merged, final forms and doubles normalised) plus a bounded edit distance. It returns a candidate ONLY when it is both close enough (similarity ≥ 0.72) AND unambiguously closer than the runner-up (margin ≥ 0.12), so a near-miss finds the intended person while an ambiguous or garbled input stays an honest not_found — never a wrong guess, which would be worse. Wired into whoIs and resolveContactTarget as a fallback, so exact behaviour is unchanged and the fuzzy layer only helps on a miss. Proven: אופירה resolves to Ofir and סוסי to Susi, while אבוקדו / בוריס / מזג האוויר stay not_found; the full suite (12,660) confirms no existing not_found regressed, so the thresholds are conservative. Note: the transcription bias already lists the friends within the 1024 cap; this fuzzy layer is the complementary catch when the bias still slips. Evidence: CODE + AUTOMATED TEST. typecheck + full suite + build. Prior: Companion Brain P0-P3 (v0.220), P5 behaviour+safety (v0.221). Next: P7 online depth, P9 companion suite, P6 actions polish.'

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
