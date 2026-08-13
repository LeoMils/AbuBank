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
  version:    '0.232.0-session-lifecycle',
  buildLabel: 'AbuBank 0.232.0 — O-LIFECYCLE: the session-lifecycle policy built as a pure deterministic reducer (src/services/sessionLifecycle.ts, 11/11 tests). Encodes the brief contract: ~12s silence stop streaming mic upstream (cost), ~25s ask once warmly (את שם?), ~45s warm goodbye and close, NEVER close or interrupt mid-task (the top rule), ~20 min one warm outward suggestion never nagging, resume keeps the thread (only the idle clocks reset). Added two lifecycle mutants to the harness (never-close-mid-task removed; goodbye no longer closes) — both KILLED; unit harness now 15/15. Honest scope: this is the tested single-source policy core + mutants; wiring it into the live realtime audio session is a medium-risk architectural follow-up, flagged in docs/warroom (not yet done). Evidence: 11/11 + harness 15/15 + full suite. Prior: flake root-fix (v0.231).',
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
