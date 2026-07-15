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
  version:    '0.82.0-family-daughter-son-spanish-identity',
  buildLabel: 'AbuBank — FAMILY_DAUGHTER_SON_SPANISH_IDENTITY (Intelligence Parity Cycle 3, text-only via the real ExecutiveCognitiveController): two family-graph parity gaps. (1) Singular מי הבת/הבן של X (who is the daughter/son of X) punted to the LLM — the relation engine only knew PLURAL children; added gender-filtered daughter/son rules (childrenByGenderPublic) so מי הבת של מרטיטה → מור, מי הבן של מרטיטה → לאו, deterministically. (2) Spanish ¿quién es X? returned the unknown fallback because the resolver regex was ^-anchored and the leading ¿ broke it (Hebrew מי זה X worked); tolerated the ¿/? punctuation and render the identity in Spanish (Abu es abuela de Ofir a través de Mor). Evidence: familyDaughterSonSpanish.test.ts 4/4 green (CODE); family regression suites 62 green; full suite green. Deferred (noted in gap map): grandchild-count queries (F6) + pronoun continuity her-mother (M2). Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.81.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
