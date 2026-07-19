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
  version:    '0.132.0-champion-challenger-duel',
  buildLabel: 'AbuBank — CHAMPION_CHALLENGER_DUEL (Cycle 52 — REVOLUTION mandate, session 2: the promotion gate). Built the Learning-Loop safety capstone (Constitution §6): a build is promotable ONLY if it beats the previous on the ENTIRE corpus with NO dimension regressing. corpusScore (src/eval/duel.ts) REUSES the existing engines — runParityGuard (parity 6 dims + marathon smoke + flight-recorder reality) + the metamorphic mirror suite (1380 mirrors) — scored into one per-dimension scorecard; no parallel path. duel() is a pure comparison: a single regressed dimension (or lost coverage) BLOCKS promotion and is named. runWeeklyDuel scores the current build, duels it against the stored champion baseline (docs/eval/CHAMPION_BASELINE.json), advances the baseline only on a pass, and writes Leo one plain-Hebrew line to docs/eval/DUEL_LATEST.md: "השבוע: X נתפסו, Y תוקנו, Z חזרו (חובה: 0 חזרו) — עבר/נחסם". PROOF (d) delivered: a deliberately regressed challenger (mirror breaks introduced) and a coverage-loss challenger are both BLOCKED and named; an equal/improved build passes. Evidence: CODE — duel 7/7 (corpus mirrors 1380, all dims green), full suite 11080 pass / 2 todo, typecheck + build. Deferred (final session): (c) weakness-map archetypes + cross-domain probes; ledger file + conversation write-path + birthdays→calendar. Builds on 0.131.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
