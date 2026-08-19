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
  version:    '0.292.0-entry',
  buildLabel: 'AbuBank 0.292.0 — PREMIUM ENTRY EXPERIENCE (supersedes 0.291.0-earonly). NEW: cold-open black-luxury intro (handwritten "Abu Ela" reveal + synthesized boutique sound), platform biometric unlock (WebAuthn Face ID/Touch ID) primary with local salted-PIN fallback, and a fail-open session-lock policy (cold launch → intro+auth; resume <60s skips; re-auth after 5min inactivity, no intro replay). Entry is an isolated top-level gate — no existing screen changed; degrades gracefully (audio autoplay/biometric unavailability fall back cleanly). Device-check pending: real Face ID sheet + audible chime are PHYSICAL_DEVICE truths. Priors (deployed 0.291): TRUE IDEMPOTENCY + ABUSE THROTTLING; A6 retrieval guard; Yarden CLASS fix; TEMPORAL=GROUNDED+FRESH. Do NOT merge (3 old keys await owner revocation).',
  buildDate:  '2026-08-19',
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
