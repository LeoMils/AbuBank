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
  version:    '0.89.0-family-siblings',
  buildLabel: 'AbuBank — FAMILY_SIBLINGS (Intelligence Parity Cycle 10, text-only via the real ExecutiveCognitiveController): probe-2 gap FAM-SIB. מי אח/אחות של X (who is the brother/sister of X) returned the unknown fallback — the relation engine had no sibling rule, though לאו is the brother of מור in the graph. Added siblingsByGenderPublic (the OTHER children of the parents, gender-filtered) + brother/sister/plural REL rules, so מי אח של מור → לאו and מי אחות של לאו → מור; a person with no sibling of that gender stays honest (never fabricates). Evidence: familySiblings.test.ts 3/3 green (CODE); family regression suites 56 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.88.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
