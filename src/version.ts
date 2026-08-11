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
  version:    '0.205.0-abuela-rollout-calendar',
  buildLabel: 'AbuBank 0.205.0 — ABUELA_M4 rollout wave 2 (Calendar): brought Abu יומן into the one design system. Added the shared per-app AbuLogo emblem (app=calendar, violet accent) beside the back control in the header so the calendar reads as one product with the hub, and moved the page root onto the themeable PAGE_BG (Night Garden) via the PageShell background prop. The gold calendar identity, the month grid, the birthday / memorial / today markers, alert banners and the voice + manual add flows are all untouched. Verified by rendering the REAL dev screen with Playwright at 412×870: the emblem sits in the header, the nebula shows behind the grid, zero horizontal overflow; the full AbuCalendar suite (52 files / 1255 tests) and typecheck stay green. Evidence: CODE + AUTOMATED TEST + BROWSER (rendered screen). Screen 3 of 4 in this wave; Weather (starfield) follows.',
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
