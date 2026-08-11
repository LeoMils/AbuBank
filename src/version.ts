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
  version:    '0.203.0-abuela-rollout-whatsapp',
  buildLabel: 'AbuBank 0.203.0 — ABUELA_M4 rollout wave 2 (WhatsApp): brought the Abu WhatsApp screen into the one design system. Added the shared per-app AbuLogo emblem to the header so it reads as one product family, and moved the page root to the themeable PAGE_BG (Night Garden) via a new optional PageShell background prop (default unchanged, so every other screen is untouched). The bespoke WA-green wordmark and the family-portrait album entry are preserved. Verified by rendering the REAL dev screen with Playwright at 412×870: the emblem sits in the header, the nebula background shows behind the family grid, zero horizontal overflow; 454 AbuWhatsApp + design-system tests and typecheck stay green. Evidence: CODE + AUTOMATED TEST + BROWSER (rendered screen). One screen of four in this wave; Games, Calendar, Weather follow, one verified commit each.',
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
