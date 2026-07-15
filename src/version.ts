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
  version:    '0.83.0-family-parent-and-pronoun-continuity',
  buildLabel: 'AbuBank — FAMILY_PARENT_AND_PRONOUN_CONTINUITY (Intelligence Parity Cycle 4, text-only via the real ExecutiveCognitiveController): closes gap M2. (1) Singular מי אמא/אבא של X (who is the mother/father of X) punted to the LLM — the relation engine had no parent rule; added gender-filtered mother/father rules (parentsByGenderPublic) so מי אמא של אופיר → מור. (2) A follow-up pronoun had no antecedent: after מי זה אופיר, the question ומי אמא שלה (and who is her mother) returned the unknown fallback. Added working-memory antecedent tracking (lastFamilySubject) + resolveFamilyPronoun, which rewrites שלה/שלו/שלהם to the last-discussed person before reasoning, so ומי אמא שלה → מי אמא של אופיר → מור. Evidence: familyPronounContinuity.test.ts 2/2 green (CODE); family + continuity regression suites 66 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.82.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
