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
  version:    '0.72.0-relation-between-martita-alias',
  buildLabel: 'AbuBank — RELATION_BETWEEN_MARTITA_ALIAS: "מה הקשר בין אופיר למרתה" used to answer "לא יודעת" because "מרתה" (Marta, the everyday spelling of the canonical "מרטיטה") was not a recognized alias, so findNode() returned null and the relation-between handler bailed. Added "מרתה" to the Martita aliases in knowledge/family_graph.json (runtime source) + knowledge/family_data.json (source of truth); the existing handler now resolves it → "מרטיטה הסבתא של אופיר (דרך מור)". Feminine forms (הסבתא / הנכדה) intact; canonical/אבו spellings and ex-spouse directionality unchanged. Builds on 0.71.0 FAMILY_EX_SPOUSE_DIRECTIONALITY.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
