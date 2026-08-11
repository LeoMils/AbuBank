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
  version:    '0.199.0-abuela-rollout-w1-rc1',
  buildLabel: 'AbuBank 0.199.0 — ABUELA_ROLLOUT_W1_RC1 (M4 rollout wave 1 + M6): a senior-first VERIFICATION gate — a WCAG contrast test proves BOTH themes (Night Garden dark + Bright Day light) meet AA 4.5:1 for body text on the worst-case background, plus the 56px touch / 16px body minimums. Because every screen inherits the tokens + shared components, this verifies senior-first legibility SYSTEM-WIDE in both themes. The shared ScreenHeader now carries the per-app Abu logo mark; Abu News and Abu Bank are fully in the Night Garden system (themeable PAGE_BG + logo). docs/DEVICE-TEST.md is written for Leo (numbered, riskiest-first, say / expect / trace, non-programmer). M2 prep: the provider abstraction, registry, adapters and bake-off (M1) make wiring the chosen winner into the endpoint a small, well-defined change — gated on a keyed winner, never faked. Staged as careful next waves: re-theming Weather / Games / Calendar / WhatsApp (Weather already carries the Night Garden starfield) and rebuilding the Abu AI screen; the illustrated character is out for commission (docs/design/CHARACTER-ASSET-SPEC.md). Evidence: CODE + AUTOMATED TEST (contrast in both themes + sizes; logo + theme applied; full suite green; typecheck 0; build 0). On-device and look/feel are PHYSICAL_DEVICE / HUMAN-EYE — NOT claimed.',
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
