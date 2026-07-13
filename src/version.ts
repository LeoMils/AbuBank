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
  version:    '0.69.0-spanish-transcript-locale-integrity',
  buildLabel: 'AbuBank — SPANISH_TRANSCRIPT_LOCALE_INTEGRITY: the mandatory Spanish scenario "Agendá una reunión con Gabi mañana a las tres" is fixed end-to-end. The Hebrew STT-recovery dedup rule used a Hebrew-only word boundary, so on Spanish text it matched the trailing "a" of "mañana" + the preposition "a" as a false "a a" duplicate and dropped the preposition → "mañana las tres"; the ES clock regex ("a las") then failed, the runtime asked "באיזו שעה?" in Hebrew, and "dale" dead-ended — nothing was created. The dedup boundary is now script-agnostic (any Unicode letter/mark), so Spanish parses correctly and the event is created exactly once at 15:00. Builds on 0.68.0 FRAGMENT_AMBIGUOUS_HOUR_PARITY.',
  buildDate:  '2026-07-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
