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
  version:    '0.268.0-layer2-events-repeat',
  buildLabel: 'AbuBank 0.268.0 — MERGE BLOCKER 1b + repeat-guard. (1) Layer-2 realtime event invariants: all 19 covered (liveSession.test) — 9 connection/error codes each yield a truthful non-empty Hebrew reason (never a throw/blank), and 10 server events each drive their invariant (speech_started->listening, transcription->surfaced, audio delta->speaking, transcript.done->Abu transcript, response.done final->listening, recoverable error non-fatal vs fatal->error). (2) DEVICE P0 repeat-lookup guard: a per-session failed-name set — a name that fails twice ("טוצי" heard as "טורקי" both times) escalates to ask_different (spell it / say who in the family) instead of running the identical failing lookup again; regression repeatLookupGuard.test. Cell coverage 76.7% -> 87.8% (event cells executed; only 15 screens + 6 Layer-3 declines remain). Prior: Layer-2 tool fuzz (v0.267).',
  buildDate:  '2026-08-15',
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
