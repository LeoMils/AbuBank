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
  version:    '0.227.0-mutation-app-layer',
  buildLabel: 'AbuBank 0.227.0 — Mutation harness extended into Layer B (App): 10 deterministic mutants + a negative control, 100% kill. Three app mutants added, all KILLED — touch-target 56→40 and body-text 16→12 (owner design/seniorFirst.test.ts; MIN_TOUCH feeds Card + PrimaryButton) and a calendar save that silently drops the title field (owner calendarPersistence.test.ts, the B4 round-trip). So the senior-UX sizing floor AND calendar data-integrity are guarded — no new bug this round, an honest confirm. The remaining brief-listed app mutants (RTL break, back-nav, name overflow) are Playwright/DOM-render level and need a SEPARATE harness; flagged in docs/warroom, not forced into the unit harness as weak proxies. Layers now covered by mutation: A/Brain+Online, A+B/Privacy, B/App-SeniorUX+DataIntegrity. Evidence: harness 10/10 + typecheck + full suite + build. Prior: online+privacy guards (v0.226).',
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
