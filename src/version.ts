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
  version:    '0.141.0-seam-feeds-all-paths',
  buildLabel: 'AbuBank — SEAM_FEEDS_ALL_PATHS (INTAKE REBUILD, session 2 · P2 complete). The ONE relation-morphology seam now feeds EVERY path, not just who-is: calendar create/title ("תקבע עם בת הזוג של מור"→"פגישה עם יעל", "עם החתן של מור"→"פגישה עם גלעד"), search (personPhraseResolver now DELEGATES to the seam — the parallel per-form resolver engine was deleted, one runtime path per capability), and the ledger (extractChange/classifyIntake take an injected person-resolver so "הבת של מור גרה בחיפה" stores the fact for אופיר, not the anchor מור — and poison like "אופיר היא אשתו של רפי" still reaches THE LAWS unchanged and is refused). Added father/mother-in-law (חם/חמות) to the seam; hardened parseRelationQuery so a greedy capture of a leading preposition ("עם החתן") never hides the real phrase. Evidence: CODE — new all-paths suite 11/11 + morphology generative + FULL suite 11474 pass / 2 todo / 0 regressions (1 test updated: a create title now carries the RESOLVED name, per P4), typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P1 understanding-first LLM layer. Builds on 0.140.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
