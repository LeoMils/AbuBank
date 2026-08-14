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
const BUILD_VERSION = '0.244.0-live-state'
const BUILD_LABEL = 'AbuBank 0.244.0 — UI STATE agent: ONE reconciled live-state indicator, and the QA badge hidden outside development. Trace defect: "you are speaking while the screen says you are listening." Mechanism: the LiveScreen state WORD read the raw session LiveState (STATE_LABEL[state], which had no "thinking"), so it could disagree with her face/aura — those read the reconciled presenceState. Change: the big spelled-out word now derives from the SAME reconciled presenceState as the face (liveStateWord), enlarged to 30px for an 80-year-old, so during an active turn it is always exactly one of מקשיבה/חושבת/מדברת and can never claim listening while she speaks or thinks. Also: the Home "QA: v…" badge is now gated to development builds only, so Martita never sees it in production (the running build stays confirmable via Settings→About + the operator diagnostic panel). Evidence: CODE — presenceState.test.ts regression (the word is driven by the reconciled state, never the raw state) + version.visibility.test.ts (badge DEV-gated) + typecheck + full suite + build. Browser/device confirmation of the on-screen render is a PHYSICAL_DEVICE item, not claimed here. Prior: reminders on the live path (v0.243).'

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
