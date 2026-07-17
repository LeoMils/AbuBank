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
  version:    '0.114.0-generalization-proofs',
  buildLabel: 'AbuBank — GENERALIZATION_PROOFS (Intelligence, text-layer): principle-C property-based proofs for the DATE engine (~1100 generated arithmetic cases — בעוד/לפני N ימים·שבועות, relative-day words, +N hours, next-weekday — each vs an independent JS-Date oracle) and CALENDAR CRUD (~440 generated create/cancel/move sequences through the real runtime, asserting store state + referability incl. pronoun "תבטלי אותה"/"תעבירי אותה"). Both GREEN — parity with the family relation generalization proof. Also corrects the typed-test doc: math ("15 כפול 4" etc.) is deterministic in-app (PREVIEW-verified 3/3), not LLM. Evidence (CODE): dateEngineGeneralization 6/6 + calendarCrudGeneralization 4/4; full suite 10998 green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.113.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
