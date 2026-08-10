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
const BUILD_VERSION = '0.187.0-live-action-cards-rc1'
const BUILD_LABEL = 'AbuBank 0.187.0 — LIVE_ACTION_CARDS_RC1 (Part B): every prepared action now produces a VISIBLE card in the live overlay — the card is the receipt, Abu never claims an action in speech alone. Generic senior-first ActionCard (title, body, one large button, dismiss; RTL, large type, high contrast). whatsapp_draft (renamed from prepare_whatsapp, now carries the FULL composed message) renders a card with recipient + message + a Send button opening https://wa.me/<number>?text=… ; phone_call (renamed from prepare_call) renders a card with name + number + a tel: Call button; both resolve the number OUTSIDE the model at the UI layer (reusing whatsappAdapter/phoneAdapter) so no number ever enters the model. Calendar drafts render a draft card (Confirm button → typed confirm into the session) and, after commit, a receipt card showing the fields AS PERSISTED (via new onCalendarSaved). Instructions describe the card and ask her to TAP; a new harness assertion (CLAIMED_UNCONFIRMED_ACTION) fails if Abu says she sent/called. liveSession change is ADDITIVE UI plumbing + a typed-confirm input only — no VAD/turn/audio change. Instruction size 9416→11974 chars (family still embedded — moves to a tool in the family milestone). Harness gpt-4o-mini 39/46 (whatsapp+phone card scenarios PASS; the rest are model clarify/save variance). Evidence: CODE + AUTOMATED TEST (83 card/tool/instruction tests green; typecheck 0; build 0). On-device tap→wa.me/tel and audibility are PHYSICAL_DEVICE — NOT claimed.'

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
