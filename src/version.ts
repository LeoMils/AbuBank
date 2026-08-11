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
  version:    '0.195.0-abuela-design-system-rc1',
  buildLabel: 'AbuBank 0.195.0 — ABUELA_DESIGN_SYSTEM_RC1 (Part 4 foundation): the design system made real and SHARED — not one-off styling per screen. Extended src/design with a spacing/radius/touch scale (space.ts: space 4→48, radius sm→pill, MIN_TOUCH=56, MIN_BODY_PX=16) on top of the existing colour + Heebo type scale, and added shared senior-first components in src/components/ui: ScreenHeader (BackButton + "Abu <name>" brand title), Card (warm glass, pressable ≥56px, per-app accent) and PrimaryButton (≥56px, large high-contrast type). Applied to the reference app Abu News (fully in the system) and Abu Bank (shared header); each app keeps its own accent within one system. Documented in docs/design-system.md (principles, tokens, components, per-app accents, adoption + rollout status). Per the brief this shows the system on the hub apps FIRST and STOPS for report — the Home brand hero and the AI / Calendar / WhatsApp / Games / Weather screens are NOT yet migrated. Evidence: CODE + AUTOMATED TEST (senior-first minimums ≥56/≥16, component render — 23 tests; full suite green; typecheck 0; build 0). "Looks world-class" is a HUMAN-EYE / PHYSICAL_DEVICE judgment — NOT claimed.',
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
