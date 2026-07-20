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
  version:    '0.144.0-garble-tolerant-seam',
  buildLabel: 'AbuBank — GARBLE_TOLERANT_SEAM (INTAKE REBUILD, session 5 · P3). Added deterministic garble-tolerance to the relation seam: a Hebrew phonetic fold (ק/ך/ח→כ, ט→ת, ע→א, ב→ו, finals) lets a single near-homophone STT slip in a relation TERM still resolve — "החטן של מור"→גלעד, "הגרבש של מור"→רפי, "בט הזוג של מור"→יעל — instead of punting. Gated to terms ≥3 chars and UNAMBIGUOUS folds (a fold that maps to two relations is refused), so it never mis-maps one relation to another; a garbled phrase resolves to a real relative or to nobody, NEVER a wrong person. Plus a permanent garble mutator (src/truth/garbleMutator.ts, index-seeded, no randomness: near-homophones + ה-noise + word split/join) and the P3 suite (measures a survival floor honestly — word-SPLIT garble is left to STT-recovery/the P1 layer, not hidden). Evidence: CODE — garble 16/16 + FULL suite 11512 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P4 calendar state-machine audit → P5–P8 → verification regime. Builds on 0.143.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
