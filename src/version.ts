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
  version:    '0.294.0-privauth',
  buildLabel: 'AbuBank 0.294.0 — REPLAY-HARDENED AUTH + PRIVATE FAMILY DATA MOVED SERVER-SIDE (supersedes 0.293.0-auth). REPLAY: WebAuthn challenges are now SINGLE-USE (server-side nonce consumption in api/_replayStore) + monotonic-counter baseline held server-side (device-cert rollback cannot lower it); the exact "replay A+C within TTL" attack is DENIED (challenge TTL tightened to 120s). Distributed single-use auto-upgrades to KV when KV_REST_API_URL/TOKEN are provisioned (owner, free-tier); otherwise per-instance (denies the immediate replay). FAIL-CLOSED: a PRODUCTION deploy missing AUTH_SIGNING_SECRET or ENROLLMENT_SECRET now blocks the build AND denies billable requests (503) — never open; /api/health exposes authEnforced/authConfigured/productionMisconfigured/replayStore. PRIVATE DATA: knowledge/family_data.json is no longer bundled — it is served only from the authenticated /api/family (Cache-Control private,no-store; SW never caches it) and hydrated at boot (+device-local IndexedDB offline). RESIDUAL: the WhatsApp contacts-seed (familyContacts.private) is a SEPARATE bundled name source — its migration is documented, not done. Device-check pending: real Face ID ceremony is PHYSICAL_DEVICE. Do NOT merge.',
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
