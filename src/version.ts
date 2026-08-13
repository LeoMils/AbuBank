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
  version:    '0.228.0-mutation-journey-platform',
  buildLabel: 'AbuBank 0.228.0 — Mutation harness extended to Layer D (Journeys) + C (Platform): 13 deterministic mutants + a negative control, 100% kill. Journey (both KILLED): card→WhatsApp handoff drops the composed message from the wa.me link (owner liveActionCards.test.ts); confirm→two-events — exactly-once dedup by call id disabled in calendarDraftController (owner calendarRuntimeIntegration.test.ts). Platform (KILLED): SW/stale-bundle detection inverted in versionSync.detectStaleBuild so a new deployed version would not be flagged stale (owner versionSync.test.ts). NOT seeded, real gap found: the idle-timeout session lifecycle (12s stop-streaming / 25s ask-once / 45s warm-goodbye / resume-with-thread / 20-min nudge) has no deterministic module to mutate — tracked O-LIFECYCLE in docs/warroom/OPEN. Evidence: harness 13/13 + typecheck + full suite + build. Prior: app-layer (v0.227).',
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
