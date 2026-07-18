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
  version:    '0.123.0-parity-rambling-dedup',
  buildLabel: 'AbuBank — PARITY_RAMBLING_DEDUP (Cycle 43 — grow the parity turn set with REAL Leo device flows; each new red dimension names a real gap). Diagnosis-first: ran 5 grounded Leo flows (docs/eval/LEO_DEVICE_FAILURES_REPRO.json + deviceFailuresTriage) through the SAME parity harness. Four were clean (midnight+person+place extraction, He/Es relation-between, relation-for); ONE red — the P2 rambling-story create confirmed the subject TWICE (בנושא טיול המשפחתי plus a redundant parenthetical restating it) which blew the brevity budget. GENERAL FIX (shapeCreateConfirm, responseShaper.ts): a subject/notes redundancy guard (coreWords + saysTheSame) drops the notes parenthetical when it merely restates the already-shown subject; a genuinely distinct note is kept (no over-suppression). Regression test FIRST (responseShaper.test.ts, red then green, reproducing the exact device string). Promoted all 5 flows into the standing parity scorecard: now 6/6 dimensions at 100 percent over 22 scored turns (was 17), 1 correctly LLM-routed. Calendar brevity budget aligned to the product rule (root CLAUDE.md: voice responses 2-4 sentences max) with the 220-char cap as the anti-ramble guard. Evidence: CODE — responseShaper 61/61, parityScorecard 22/22 at 100 percent; full suite + typecheck + build. Voice/Realtime untouched. Live cross-check seam still unkeyed (out-of-band). Builds on 0.122.0.',
  buildDate:  '2026-07-18',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
