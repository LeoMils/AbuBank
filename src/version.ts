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
  version:    '0.60.0-private-family-phones-import',
  buildLabel: 'AbuBank — Private Family Phones import at /settings/family-phones: select a .json file or paste the JSON array of { id, enabled, phoneE164 }; Israeli local + E.164 accepted and normalized; validated and matched to family by stable id; masked preview; explicit confirmation; stored ONLY in device-local IndexedDB. Import/replace/export/delete. Real numbers never touch Git, source, tests, logs, diagnostics, Evolution, Vercel, prompts, or SW cache. Voice-runtime repairs from 0.59.1 preserved.',
  buildDate:  '2026-07-10',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
