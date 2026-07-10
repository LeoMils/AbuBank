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
  version:    '0.58.0-evolution-os-observe-slice',
  buildLabel: 'AbuBank — Evolution OS (OBSERVE_ONLY): per-turn redacted trace envelope → durable append-only evidence queue → explicit/implicit/automatic signal detection → append-only case state machine. Structurally cannot change the served answer; global + per-domain kill switches. Beneath AbuAI, never rewriting it from raw feedback.',
  buildDate:  '2026-07-10',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
