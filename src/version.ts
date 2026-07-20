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
  version:    '0.150.0-shadow-validated-retirement',
  buildLabel: 'AbuBank — SHADOW_VALIDATED_RETIREMENT (INTAKE REBUILD, session 11 · standing obligations #2/#6/#13/#14). Discharged the SHADOW-VALIDATION law for the family intake: built a reusable shadow harness (src/eval/intakeShadow.ts) that runs the OLD pattern intake and the NEW morphology seam in PARALLEL over a 1419-turn corpus and classifies every divergence. Result — agree=1101, RECOVERED=318 (in-laws/possessive/garble the legacy intake punted), REGRESSED=0, DISAGREE=0 → the seam is a proven strict SUPERSET. Retirement criterion (regressed=0 AND disagree=0) MET, so the legacy REL pattern list was RETIRED from the live path (answerFamilyRelation is now seam-ONLY) and quarantined in legacyFamilyIntake.ts as the shadow baseline only — one intake per capability, not two. First added the seam superset piece it was missing (the "ממי X גרושה" from-whom ex shape). Standing obligations recorded as repo law in docs/engineering-os/STANDING_PROOF_OBLIGATIONS.md. Evidence: CODE — intakeShadow 5/5 (0 regress, 0 disagree, 318 recovered) + FULL suite 11552 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides ready. NEXT: fail-closed suite (#9), latency stage KPIs (#8), shadow over create/ledger paths, meaning-cache (#10), transcript→gold pipeline (#11). Builds on 0.149.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
