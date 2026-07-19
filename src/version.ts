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
  version:    '0.131.0-constitution-foundation',
  buildLabel: 'AbuBank — CONSTITUTION_FOUNDATION (Cycle 51 — REVOLUTION mandate, session 1: the two keystones). Built the Truth-Loop and Learning-Loop keystones as pure, CODE-provable mechanisms. (1) THE LAWS (src/truth/familyLaws.ts) — a family-universe invariant suite enforced at a single WRITE GATE (applyChange): relation symmetry BY CONSTRUCTION (spouse↔spouse, parent↔child), no parenthood cycles (L2), parent-older-than-child (L4), monogamy + incest guard (L7), siblings-share-parents (L3), one-identity/alias quarantine (L5), ages-from-birthdate only (L6), no self-relation (L8). A contradiction can no longer ENTER — it is rejected at the gate with a one-line Hebrew reason, and a rejected write leaves the ledger byte-for-byte unchanged. applyBatch returns a one-line diff per fact for a manual upload. Seeded from the REAL graph (ledgerSeed). (2) METAMORPHIC MIRROR SUITE (src/truth/mirrorSuite.ts) — 1380 oracle-free consistency checks over the real relation engine (inverse-existence + paraphrase-alias, He+Es), plus a structural spouse-symmetry mirror. PROOFS delivered: (a) planted contradiction REJECTED at the gate; (b) 1000+ mirrors pass AND a planted asymmetry caught by mirrors alone; (e) poisoning never stores; (f) manual upload conflict surfaces a one-line diff. Evidence: CODE — familyLaws 10/10, mirrorSuite 3/3 (1380 mirrors, 0 breaks), full suite + typecheck + build. Deferred to next sessions: (c) cross-domain archetype/weakness-map, (d) champion/challenger duel, ledger file + conversation write-path + birthdays→calendar. Builds on 0.130.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
