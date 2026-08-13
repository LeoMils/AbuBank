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
  version:    '0.229.0-mutation-dom-playwright',
  buildLabel: 'AbuBank 0.229.0 — DOM mutation harness (Playwright) built + proven: scripts/mutation-harness-e2e.mjs runs specs against a live dev server for layout facts jsdom cannot prove, probes the server first (down != survived), restores every file in finally. Two DOM mutants, both KILLED (BROWSER evidence): RTL — index.html dir=rtl flipped to ltr, owner the new red-before-green e2e/rtl-direction.spec.ts (green on correct in 8.4s, red under mutation); touch-target — MIN_TOUCH 56 to 30 falls below the enlarged-text 40px rendered floor. Closes the App RTL/overflow gap the unit harness honestly could not cover; back-nav + name-overflow still need owning specs. Unit harness stays 13/13; DOM harness 2/2. Evidence: unit 13/13 + DOM 2/2 + typecheck + full suite + build. Prior: journey+platform (v0.228).',
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
