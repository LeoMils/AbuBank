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
  version:    '0.231.0-flake-root-fix',
  buildLabel: 'AbuBank 0.231.0 — O-FLAKE fixed at the root, no retries. Two communication tests (capability, productionGates) intermittently failed under full-suite parallel load because buildCommunicationAction → composeWhatsAppMessageDetailed made REAL provider calls: the openai-server proxy then a real Groq client fetch (20s timeouts) once VITE_GROQ_API_KEY landed in .env — breaking the tests own stated assumption that providers are unreachable in unit tests. Under contention those 20s waits blew the per-test timeout (observed 6-7s runtimes); in isolation they completed. Fix: stub fetch to fail fast in both files, forcing the deterministic local composer — hermetic, no network, no retry band-aid. Runtime dropped from ~6-7s to 167ms. Evidence: both green + full suite. Prior: always-on invariants (v0.230).',
  buildDate:  '2026-08-13',
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
