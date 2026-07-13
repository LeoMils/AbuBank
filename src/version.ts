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
  version:    '0.66.0-fragmented-create-continuity',
  buildLabel: 'AbuBank — FRAGMENTED_CREATE_CONTINUITY: when Martita builds an appointment across separate turns — "תקבעי" → "עם מור" → "מחר בשלוש" → "כן" — a bare create opener now opens a pending draft that ABSORBS the following fragments instead of orphaning each to the LLM (the red-team #1 failure "fragmented-create-lost" drops 60→24 conversations; remaining = an ambiguous bare-hour AM/PM parity gap). Guarded to a genuine opener (starts with a scheduling verb, no clue) so no benign turn opens a stray draft. Builds on 0.65.0 CURRENT_INFO_GROUNDING.',
  buildDate:  '2026-07-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
