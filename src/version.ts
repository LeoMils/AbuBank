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
  version:    '0.120.0-marathon-ordinal',
  buildLabel: 'AbuBank — MARATHON_ORDINAL (Cycle 40 — widen further: cross-language referability + ordinal delete): added CROSS-LANGUAGE referable-cancel (Hebrew create → Spanish "cancelalo", and ES create → Hebrew "תבטלי אותה") and a "the FIRST one" delete chain to the 1200-session marathon. Cross-language cancel was already CLEAN (the referable gate is language-agnostic once focus is set). The new class exposed 1 general bug: ORDINAL DELETE — "תבטלי את הפגישה הראשונה" (cancel the FIRST meeting) deleted the FOCUSED/last event, because deleteReasoner had no ordinal handling; added ORDINAL_FIRST_RE → select the chronologically-earliest event ("last/האחרונה" already resolves via the focus path, left unchanged). Evidence (CODE at app-entry level): generativeMarathon 1200/1200 clean across 10 scenario classes; full suite green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.119.0.',
  buildDate:  '2026-07-17',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
