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
  version:    '0.204.0-abuela-rollout-games',
  buildLabel: 'AbuBank 0.204.0 — ABUELA_M4 rollout wave 2 (Games): brought Abu Games into the one logo family. Added the shared per-app AbuLogo emblem (app=games) as a crest above the AbuGames wordmark so the bright terrace lobby reads as one product with the hub. Per the design-lock this screen is NOT forced dark: the sunlit terrace scene — sky wash, wooden podium, floral clusters and the three hero cards (WOW Words / Solitaire / Mahjong) — is untouched, and no PAGE_BG or dark tokens are applied. Verified by rendering the REAL dev screen with Playwright at 412×870: the emblem crest is present, the terrace is intact, zero horizontal overflow; 19 wowGame design-lock tests and typecheck stay green. Evidence: CODE + AUTOMATED TEST + BROWSER (rendered screen). Screen 2 of 4 in this wave; Calendar and Weather follow, one verified commit each.',
  buildDate:  '2026-08-11',
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
