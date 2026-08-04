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
const BUILD_VERSION = '0.177.0-calendar-runtime-integration-rc'
const BUILD_LABEL = 'AbuBank 0.177.0 — CALENDAR_RUNTIME_INTEGRATION (ADR-0001 §12): calendarDraft wired into the live realtime slice — calendar function-tools declared + a thin CalendarDraftController routed at parity with communication (index.tsx constructs both under ?voice=realtime2; disjoint routing; no second brain). Closes the hostile-audit CAL-RUNTIME-INTEGRATION defect. — LATENCY_VAD_INSTRUMENTATION (ADR-0001 §9): privacy-safe PURE turn-timing substrate — content-free lifecycle marks → phase latencies → budgets/rollback triggers → median/p95/p99 distributions; INTEGRATION-proven with an independent verifier + mutation proof. Also: production-gate staleness is now SOURCE-aware (doc-only commits do not stale the fingerprint) + a seal step. — DENIAL_DIAL_FALSE_NEGATIVE + DESTRUCTIVE_SWEEP (ADR-0001 §7/§12). Destructive/mutation sweep of the REAL adapter chain (control plane→kernel→orchestrator→controller) found CD-FN-001: the capability-denial monitor matched "לא יכולה להתקשר" but NOT "לא יכולה לחייג" (to dial), so the model could deny a READY call capability unchecked. Fixed by adding the dial verb to the denial set (mechanism, not phrase). New destructiveSweep.test.ts attacks stale/generation+revision rejection, cancel/replace WHILE a tool result is in flight, exactly-once across duplicate/reordered completion shapes, privacy of args/receipts, safe-label vs local-phone resolution, fallback/reconnect not reviving cancelled actions, greeting-once across reconnect, one canonical projection — each proven to die under an injected control-plane + truth-monitor mutation. Evidence: CODE+TEST (sweep+monitor+livePath 42; typecheck 0; full suite; build). PHYSICAL/live-provider/deployed-telemetry unchanged and still blocked. — TRUTHMONITOR_HEBREW_HARDENED (ADR-0001 §7/§16): certified the forward-Hebrew false-positive fix with 22 adversarial Hebrew variants (punctuation, ו/כ/ש prefixes, mixed clauses, questions, negation, capability-denial both ways) — real 1st-person fabricated completions still caught; test-only hardening over 0.173.0. — REALTIME_TRUTHMONITOR_FORWARD_HEBREW_FP (ADR-0001 §7/§16). Fixes two truth-monitor FALSE POSITIVES in normal forward Hebrew found by a production-convergence audit: (1) the "כבר…" completion group carried 2nd-person "שלחת" ("YOU sent"), so an assistant question like "כבר שלחת לו?" was wrongly flagged as a fabricated 1st-person completion and would trigger a nonsensical self-repair; (2) "דיברתי עם" lacked the "לא " negation guard every other completion verb had, so "לא דיברתי עם מור" over-blocked. Both now require the negation guard and count only first-person claims; positive fabrications ("כבר שלחתי", "דיברתי עם … והכל סודר") stay caught. Red-first regression tests added. Evidence: CODE + TEST (truthMonitor + realtimeLivePath + realtime slice green; typecheck 0; full suite 11940). PHYSICAL-ONLY unchanged. Builds on 0.172.0. — REALTIME_LIVE_FUNCTIONTOOL (ADR-0001 §12/§17-5). Wires the ACTUAL live WebRTC Realtime function-tool path behind ?voice=realtime2 (needs the realtime beta; OFF by default; certified brain-driven voice path unchanged). buildRealtimeSessionUpdate declares session.tools (prepare_whatsapp/prepare_call/replace_active_action/cancel_active_action) + tool_choice auto + create_response TRUE ONLY in slice mode; RealtimeVoiceSession routes a completed function_call (response.output_item.done / response.function_call_arguments.done / response.done) through realtimeFunctionBridge → RealtimeCommController → SessionOrchestrator (control plane commits, kernel resolves via the ONE buildCommunicationAction authority) → SAFE function_call_output (never a number/completion) + response.create → the model speaks grounded, guarded by the streaming truth monitor (fabricated completion / unsupported denial → repair next turn + incident). The committed ActiveActionViewModel renders the canonical in-session ActiveActionCard while the conversation stays live. Idempotent by model call_id; recipient/revision/generation on every receipt; atomic Call↔WhatsApp replace. FIX: the truth monitor no longer over-blocks a NEGATED completion ("לא נשלח") — a false-positive the live-path campaign caught. Evidence: CODE + TEST (realtime slice suite incl. a production-faithful RealtimeVoiceSession adapter journey via injected server events, tool schemas, event bridge, live controller, negation regression; typecheck 0; build green; full suite). PHYSICAL-ONLY: the real mic→model→tool→audio round-trip + Hebrew naturalness per §20 — not claimed. Builds on 0.170.0.'

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
