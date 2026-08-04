/*
 * AbuBank — build identity. Single source of truth for the visible version
 * label, branch hint, and operator-readable build name. Imported by main.tsx
 * (startup console.info) and by Settings/About (visible badge).
 *
 * IMPORTANT
 * - This is a build-identity surface, NOT a feature flag.
 * - Do not store secrets, tokens, or private data here.
 * - Bump `version` and `buildDate` each time a new operator-testable build ships.
 * - The package.json semver is exposed separately as `import.meta.env.VITE_APP_VERSION`.
 */

export const APP_VERSION = {
  appName:    'AbuBank',
  version:    '0.171.0-realtime-live-functiontool-rc',
  buildLabel: 'AbuBank — REALTIME_LIVE_FUNCTIONTOOL (ADR-0001 §12/§17-5). Wires the ACTUAL live WebRTC Realtime function-tool path behind ?voice=realtime2 (needs the realtime beta; OFF by default; certified brain-driven voice path unchanged). buildRealtimeSessionUpdate declares session.tools (prepare_whatsapp/prepare_call/replace_active_action/cancel_active_action) + tool_choice auto + create_response TRUE ONLY in slice mode; RealtimeVoiceSession routes a completed function_call (response.output_item.done / response.function_call_arguments.done / response.done) through realtimeFunctionBridge → RealtimeCommController → SessionOrchestrator (control plane commits, kernel resolves via the ONE buildCommunicationAction authority) → SAFE function_call_output (never a number/completion) + response.create → the model speaks grounded, guarded by the streaming truth monitor (fabricated completion / unsupported denial → repair next turn + incident). The committed ActiveActionViewModel renders the canonical in-session ActiveActionCard while the conversation stays live. Idempotent by model call_id; recipient/revision/generation on every receipt; atomic Call↔WhatsApp replace. FIX: the truth monitor no longer over-blocks a NEGATED completion ("לא נשלח") — a false-positive the live-path campaign caught. Evidence: CODE + TEST (realtime slice suite incl. a production-faithful RealtimeVoiceSession adapter journey via injected server events, tool schemas, event bridge, live controller, negation regression; typecheck 0; build green; full suite). PHYSICAL-ONLY: the real mic→model→tool→audio round-trip + Hebrew naturalness per §20 — not claimed. Builds on 0.170.0.',
  buildDate:  '2026-08-04',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
