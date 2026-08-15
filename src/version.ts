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
  version:    '0.277.0-earonly',
  buildLabel: 'AbuBank 0.277.0 — TOOL-RESULT-HANG FIX (overnight P0): a tool result must ALWAYS produce speech. Owner device trace showed the cinema lookup returned and Abu then went silent for 60s (screen stuck on מחפשת). FIRST DIVERGENCE: in two-response mode the grounded response.create that LiveTools sends after a tool result was DEFERRED (FIX 4, decision response still active), and the two-response decision-done branch broke WITHOUT flushing it — a regression from our own v0.276 two-response fix. FIX: the decision-done branch now flushes the deferred grounded response on a tool turn, and a universal WATCHDOG (LIVE_TOOL_RESULT_AUDIO_TIMEOUT_MS=4s) forces a response if no audio follows any tool result, on every path. Red-first regressions for both. Prior: VOICE-INVALID-VALUE (v0.276), LAYER3-SAFETY (v0.275). Do NOT merge (production serves Aug 5).',
  buildDate:  '2026-08-16',
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
