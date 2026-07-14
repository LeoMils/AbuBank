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
  version:    '0.73.0-spanish-create-completes',
  buildLabel: 'AbuBank — SPANISH_CREATE_COMPLETES: the Spanish calendar create now finishes end-to-end. (1) An AM/PM-ambiguous bare hour ("anotá una cita el viernes a las diez") no longer dead-ends — a single-utterance es create resolves it to the default reading and moves to confirm (es analog of 0.68.0), so "dale" saves once at 10:00. (2) A Spanish "no" (and cancelá / dejá / olvidate / mejor no / nada) now cancels in Spanish ("Dale, lo cancelé…") instead of punting to the LLM; a correction that merely starts with "no" ("no, a las cuatro") is NOT a cancel. (3) The person-less es title is the schedulable noun with correct gender ("una cita" / "un turno") instead of the raw request echoed back. Builds on 0.72.0 RELATION_BETWEEN_MARTITA_ALIAS.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
