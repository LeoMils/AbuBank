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
  version:    '0.293.0-auth',
  buildLabel: 'AbuBank 0.293.0 — SERVER-VERIFIED AUTH (supersedes 0.292.1-entry). Closes the no-login exposure: the billable Abu APIs (chat/tts/stt/online/news/realtime-token) now REQUIRE a server-verified session — an unauthenticated caller gets 401 with ZERO provider call, so the internet can no longer spend the owner keys. Real WebAuthn/passkey: server-generated challenge → navigator.credentials → SimpleWebAuthn verifies challenge/origin/RP/signature/UV → HttpOnly session cookie. Enrollment is owner-bootstrapped (ENROLLMENT_SECRET; no self-enrol). Stateless HMAC-signed session + device-cert cookies (no shared KV). PIN stays the LOCAL fallback (PIN-only unlock grants no server session — server stays protected). Entry UX unchanged: intro → Face ID → app. RESIDUAL: private family data still bundled in public client assets (materially larger migration — reported, not closed). Device-check pending: real Face ID passkey ceremony is PHYSICAL_DEVICE. Do NOT merge (3 old keys await owner revocation).',
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
