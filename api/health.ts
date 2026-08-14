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
const BUILD_VERSION = '0.243.0-live-reminders'
const BUILD_LABEL = 'AbuBank 0.243.0 — REMINDERS on the live path (convergence v3, queue #2). In the trace Abu said she has no way to set a reminder or timer — because the realtime path had no reminder tool, though the full AbuCalendar reminders estate (parser, durable store, due-engine, sound, native delivery) already existed. Fix: registered ONE live tool set_reminder (one dispatch line in liveTools.ts) that parses relative and absolute Hebrew phrasing via the existing reminderParser and creates a durable reminder via createReminder. A local normalization handles the bare singular בעוד דקה (the exact trace phrase INC-07) which the estate parser did not. The permitted-speech line forbids ever saying she cannot set a reminder; a missing time asks rather than refuses. MEASURED on the real gpt-realtime instrument: בעוד דקה gave a real reminder at a concrete time; כל בוקר בשמונה gave a recurring reminder. Tests reminderLive (5: relative/absolute/recurring/needs-detail/registered) + mutant live-reminder-not-persisted KILLED. The popup, sound, fires-on-time and reload-survival are handled by the existing ReminderDueEngine + reminderSound + durable store — DEVICE-VERIFICATION items (audio/device stays out per rule E). Prior: care+memory refine (v0.242).'

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
