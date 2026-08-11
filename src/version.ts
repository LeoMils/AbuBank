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
  version:    '0.206.0-abuela-rollout-weather',
  buildLabel: 'AbuBank 0.206.0 — ABUELA_M4 rollout wave 2 (Weather, final screen — STEP 3 complete): brought Abu מזג אוויר into the one design system. Added the shared per-app AbuLogo emblem (app=weather, sky-blue accent) beside the back control in the sky-hero header, and moved the page root plus the content section onto the themeable PAGE_BG (Night Garden). The delicate sky hero — the mood-driven skyGrad, the hero icon, the huge temperature, the sunrise / sunset strip and the night starfield overlay — is entirely untouched; only the flat page fills (formerly a hard-coded deep navy) became the themed nebula. Verified by rendering the REAL dev screen with Playwright at 412×870 with live data: the emblem sits in the header, the sky hero is intact, the nebula shows behind the content cards, zero horizontal overflow; hub + release-gate tests and typecheck stay green. Evidence: CODE + AUTOMATED TEST + BROWSER (rendered screen). STEP 3 complete: all four screens (WhatsApp, Games, Calendar, Weather) now carry the one logo family.',
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
