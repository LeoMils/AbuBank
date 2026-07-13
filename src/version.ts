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
  version:    '0.65.0-current-info-grounding',
  buildLabel: 'AbuBank — CURRENT_INFO_GROUNDING: volatile world-fact questions (current office holders, election results, championship winners) now route to the live online provider — or an honest "cannot check" on failure — instead of leaking to the offline general path and being answered from stale model memory (the 2022-World-Cup-for-2026 class). Root fix: a semantic requiresCurrentInfo() detector + a current-fact carve-out in the personal block. Builds on 0.64.0 DURABLE_FLUSH_ON_HIDE.',
  buildDate:  '2026-07-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
