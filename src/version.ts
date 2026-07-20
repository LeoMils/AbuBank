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
  version:    '0.140.0-relation-morphology-seam',
  buildLabel: 'AbuBank — RELATION_MORPHOLOGY_SEAM (INTAKE REBUILD, session 1 · P2). Understanding-first groundwork: mapped the current pattern-bound intake (chat=runCognitiveTurn/classifyIntent, calendar=isCreateIntent, ledger=classifyIntake/extractChange) and built the ONE morphology normalization seam for Hebrew relation terms — src/truth/relationMorphology.ts. A table-driven inflection space (bare, definite ה־, construct, possessive suffixes אמו/בתה/כלתו/חתנו/גיסתה, analytic בן הזוג, plurals) → canonical RelationType, consumed by answerFamilyRelation as the gate (legacy REL kept only as fast-path fallback for the not-yet-migrated ממי-גרושה shape). NEW capability the old pattern intake could not resolve: in-law who-is — "מי החתן של מור"→גלעד, "מי הכלה של מור"→ירדן — plus every inflection of a term now resolves to the same person instead of punting to the LLM. Honest emptiness preserved (Ofir has no aunt → known=false, never invented). Generative suite (310, auto-generated from the table × the live graph). Evidence: CODE — morphology 310/310, FULL suite 11433 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. Remaining mandate P1 (LLM understanding layer), P3–P8 + verification regime: NOT started. Builds on 0.139.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
