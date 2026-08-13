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
  version:    '0.225.0-mutation-harness-label-guard',
  buildLabel: 'AbuBank 0.225.0 — Phase M: the test of the tests. Built the missing mutation harness (scripts/mutation-harness.mjs) and pointed it at deterministic guards. First run: 80% kill (4/5). The survivor was real — swapping the feminine/masculine grandchild term in familyRelationEngine (נכדה⇄נכד) passed the ENTIRE 12662-test suite, verified by running the full suite against the mutation. Mechanism: labelFor() emits female?pair[0]:pair[1] and relationOf() speaks it to Martita, so a swap calls a granddaughter "נכד" (grandson) — the existing ofirGenderRegression guards the gender DATA field but never the OUTPUT label. Closed it with a generalized red-before-green property test (familyRelationLabelGender.test.ts) over the live graph: every female grandchild must be נכדה, every male נכד-not-נכדה. Re-ran the harness: 100% (5/5), negative control still survives. Not a live bug today — a closed blind spot the suite can now feel. Evidence: harness 5/5 + typecheck + full suite (12,666) + build; docs/warroom/ holds the coverage matrix and the honest empty cells. Prior: P9 measured (v0.224).',
  buildDate:  '2026-08-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  // DIAGNOSTIC-INTEGRITY: the real deployed commit SHA is injected at build time
  // (Vercel VERCEL_GIT_COMMIT_SHA → VITE_COMMIT_SHA). Falls back to 'local' only for
  // a local dev build. Fixes the device-falsified `commit=local` in live diagnostics.
  commitHint: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_COMMIT_SHA) || 'local',
} as const

export type AppVersion = typeof APP_VERSION

/**
 * A compact, screenshot-friendly build fingerprint. Rendered in the corner of the
 * live Abu overlay so any screenshot PROVES which build actually ran on the device
 * (version + real commit SHA). Not a secret — build identity only.
 */
export const BUILD_ID = `${APP_VERSION.version}·${APP_VERSION.commitHint}`
