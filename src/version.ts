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
  version:    '0.216.0-active-response-nonfatal',
  buildLabel: 'AbuBank 0.216.0 — FIX 4: the conversation_already_has_active_response crash that killed a session every minute is fixed. Mechanism: the Realtime API allows ONE active response at a time, and with interrupt_response FALSE (kept, it is the echo/truncation fix) the server never clears the active one — so when the user spoke while a response was in flight (a tool call open), the VAD create_response collided, the error came back, and the handler called fail() and tore the whole session down. Fix: (1) response.create is now gated behind an active-response tracker (set on response.created / our own send, cleared on response.done); a create requested while one is active is DEFERRED and flushed on response.done, so we never self-collide (tool results, the typed calendar confirm, the greeting). (2) The race itself is NON-FATAL — conversation_already_has_active_response and response_cancel_not_active are recorded as recoverable, never fail the session — and the buffered user turn is answered with a fresh response once the in-flight one completes, so a barge-in is handled instead of lost. Evidence: CODE + AUTOMATED TEST (liveSession regressions: non-fatal, deferred-then-flushed, buffered-turn-answered; full suite + build). Not yet device-proven that sessions now survive a full call — needs a physical reconnect. Prior in this branch: FIX 1+2 (v0.215) one retrieval path for all 68 people plus Hebrew path descriptions (reachability harness 215/215). Still open: FIX 3 history retrieval, FIX 5 tool timeouts, FIX 6 news/cinema depth, FIX 7 the instantAcknowledgement preamble seed, FIX 8 audio.',
  buildDate:  '2026-08-13',
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
