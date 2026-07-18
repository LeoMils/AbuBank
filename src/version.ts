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
  version:    '0.126.0-crosslang-supersede',
  buildLabel: 'AbuBank — CROSSLANG_SUPERSEDE (Cycle 46 — fix the single-session cross-language contamination surfaced by the browser E2E vs preview). First divergence: with a Hebrew create left on a pending נכון?, a Spanish create (agendá una reunión con Gabi mañana a las tres) rendered a Spanish confirm for Gabi BUT the createState draft stayed on the stale Hebrew person (גלעד) — because classifySignalV2 new-create detection was Hebrew-only, so the Spanish create was misread as a side_question and side_keep restored the stale draft; the next dale, agendalo then SAVED גלעד in Hebrew (confirm did not match the read-back). ROOT FIX (conversationEngineV2.ts): a NON-Hebrew genuine create (isCreateIntent, which already covers Rioplatense agendá/anotá/programá + schedule clue, and not a draft-edit) now classifies as new_create → replace, so the pending draft is superseded and the confirm saves the read-back person. Scoped to non-Hebrew input so Hebrew incremental collecting is untouched (the Hebrew full-create path already worked). RED-first: crossLanguageDraftSupersession.test reproduced the save-of-stale-draft before the fix (He→Es), with the Es→He direction already green. Evidence: CODE — crossLanguageDraftSupersession 2/2, conversation/calendar/parity suites green; full suite + typecheck + build. PREVIEW: fresh deploy + e2e/preview-parity single-session supersession re-run vs the deployed build. Voice/Realtime untouched. Builds on 0.125.0.',
  buildDate:  '2026-07-18',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
