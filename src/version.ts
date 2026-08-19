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
  version:    '0.292.1-entry',
  buildLabel: 'AbuBank 0.292.1 — PREMIUM ENTRY EXPERIENCE (hardened; supersedes 0.291.0-earonly). Auth is now FAIL-CLOSED: mandatory first-run PIN + optional Face ID/Touch ID enroll (no "Later" bypass); a wrong PIN or any auth-subsystem error stays LOCKED — no silent open. Intro upgraded to a purpose-built calligraphic "Abu Ela" signature drawn stroke-by-stroke (SVG stroke-dashoffset) with a refined ink/airy-bed/completion-signature sound. Home/shell polished into the black-luxury system: warm graphite base, champagne/ivory type, unified tiles (feature colour kept only in the icons). Entry is an isolated top-level gate; production build has NO gate bypass. Device-check pending: real Face ID sheet + audible chime are PHYSICAL_DEVICE truths. Priors (deployed 0.291): TRUE IDEMPOTENCY + ABUSE THROTTLING. Do NOT merge (3 old keys await owner revocation).',
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
