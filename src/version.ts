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
  version:    '0.190.0-live-device-trace-fixes-rc1',
  buildLabel: 'AbuBank 0.190.0 — LIVE_DEVICE_TRACE_FIXES_RC1: four fixes from the first real-device trace. (1) DUPLICATE DISPATCH — the same completed call arrives in three event shapes (function_call_arguments.done / output_item.done / response.done) sharing one call_id; handleToolCall now dedups by call_id at the dispatch BOUNDARY so ONE model tool call = ONE execution (recorder, wait-ack, and calendar commit each fire once) — a triple confirm can no longer double an event. (2) HEBREW TRANSCRIPTION — gpt-4o-mini-transcribe → gpt-4o-transcribe, language pinned "he", plus a bias prompt built from the family Hebrew names/aliases + common request phrasings (buildTranscriptionPrompt). (3) BARGE-IN — server_vad threshold raised 0.5 → 0.7 (LIVE_VAD_THRESHOLD; prefix_padding/silence now exported constants) so brief room noise stops interrupting Abu, while interrupt_response stays true for genuine barge-in. (4) SILENT TURNS — a response.done that CARRIES a function call is no longer end-of-turn (grounded speech lands in the same turn), and wait_for_user is exempt from the silent-turn detector (its contract is silence). Recorder: each confirm_calendar_event entry records its confirmation source (voice / typed / inferred). Evidence: CODE + AUTOMATED TEST (regression tests for one-execution, mid-turn continuation, wait_for_user exemption, confirm provenance, transcription/VAD config; full suite green; typecheck 0; build 0). LLM harness BLOCKED here (no OPENAI_API_KEY). On-device transcription accuracy, barge-in feel, and audibility are PHYSICAL_DEVICE — NOT claimed.',
  buildDate:  '2026-08-10',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  // DIAGNOSTIC-INTEGRITY: the real deployed commit SHA is injected at build time
  // (Vercel VERCEL_GIT_COMMIT_SHA → VITE_COMMIT_SHA). Falls back to 'local' only for
  // a local dev build. Fixes the device-falsified `commit=local` in live diagnostics.
  commitHint: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_COMMIT_SHA) || 'local',
} as const

export type AppVersion = typeof APP_VERSION

/**
 * A compact, screenshot-friendly build fingerprint. Rendered in the corner of the
 * live Abu overlay so any screenshot PROVES which build actually ran on the device
 * (version + real commit SHA). Not a secret — build identity only.
 */
export const BUILD_ID = `${APP_VERSION.version}·${APP_VERSION.commitHint}`
