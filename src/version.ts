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
  version:    '0.105.0-inlaw-composition',
  buildLabel: 'AbuBank — INLAW_COMPOSITION (Intelligence, text-layer): the directional family relation engine now DERIVES any in-law by composing ONE marriage edge with the existing blood-relation algebra at ANY depth (spouse-of-a-blood-relative OR blood-relative-of-a-spouse), replacing the marriage+one-hop-only ladder. Fixes the false "לא יודעת" dead-end on graph-derivable in-laws — Yarden↔Noam (wife of a cousin), Gilad↔Leo (husband of a niece), Yarden↔Martita (wife of a grandson) — He+Es, symmetric. Additive: runs only after the named ladder falls through, so no named relation regresses. Adds a property-based generalization proof over ALL real person-pairs (240): no false dead-ends, correct gender, He/Es/En parity. Evidence (CODE): family/relation + inverse-consistency + benchmark(100%) green; typecheck clean. Voice/Realtime untouched. Builds on 0.104.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
