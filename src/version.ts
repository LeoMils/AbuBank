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
  version:    '0.264.0-surname-guard',
  buildLabel: 'AbuBank 0.264.0 — AMENDMENT: subsetResolve fabrication guard. The prior full-name fix resolved a unique given name even with a WRONG surname, so a public figure sharing a given name (Yitzhak Rabin) would confidently return the family member — fabrication, not helpfulness. Fix: a spoken surname is EVIDENCE. subsetResolve now returns CONFLICT when an extra word (a surname) is not a confirmed token of the entity own names; whoIs then does not silently assert identity and resolveContactTarget asks (single-candidate ambiguous) instead of resolving; suggestForMiss offers the exact candidate so Abu asks did-you-mean by name. A CONFIRMED surname still resolves. Regression fullNameLookup.test: family given name + a public-figure surname never resolves; no living person is silently resolved by givenName + an unknown surname. 313 people/tools tests green. Prior: mishear suggest (v0.263).',
  buildDate:  '2026-08-15',
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
