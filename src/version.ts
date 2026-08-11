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
  version:    '0.198.0-abuela-brand-foundation-rc1',
  buildLabel: 'AbuBank 0.198.0 — ABUELA_BRAND_FOUNDATION_RC1 (M4 foundation): the chosen Night Garden brand direction, built THEMEABLE. A CSS-variable theme (src/design/theme.css + theme.ts) flips the whole product from the dark Night Garden palette to a light Bright Day palette by ONE attribute (data-abu-theme) — no rebuild, no re-render (condition 1). A per-app Abu logo FAMILY as SVG components (src/design/logos/AbuLogo): seven luminous emblems (AI / News / Bank / WhatsApp / Weather / Games / Calendar) sharing one construction — a glow disc, an accent rim, and the constant Abu spark — with a distinct glyph + constellation accent each, unmistakably one family. The HUB now uses the logo marks + themeable tokens + the Night Garden page background. A character STILL FRAME for M5 direction 3 (docs/design/abu-bust-still.svg + .png) is delivered for approval BEFORE any animation (condition 2). Applied so far to the hub only; rolling the system + logos across all seven app screens is the next wave, reported first per the brief. Evidence: CODE + AUTOMATED TEST (theme switch + no-hard-coded-colour; logo family distinct + accent + spark — 6 tests; full suite 12333 pass; typecheck 0; build 0). Look/feel and the character judgement are HUMAN-EYE, awaiting Leo. On-device is PHYSICAL_DEVICE — NOT claimed.',
  buildDate:  '2026-08-10',
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
