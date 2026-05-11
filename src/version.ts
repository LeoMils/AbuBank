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
  version:    '0.4.6-platform-health-recovery',
  buildLabel: 'AbuBank P0 — Platform/API Health Recovery',
  buildDate:  '2026-05-11',
  branchHint: 'feat/abuwhatsapp-local-family-contacts',
  commitHint: '6e7d7aa',
} as const

export type AppVersion = typeof APP_VERSION
