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
  version:    '0.289.0-earonly',
  buildLabel: 'AbuBank 0.289.0 — MONSTER QA HARDENING (distinct RC identity; supersedes 0.288.0). RUNTIME change: (A6) retrieved web content is UNTRUSTED DATA — retrievalGuard neutralizes injection directives (override-instructions / reveal-secret / tool-call / recipient-exfil / forged-authority) BEFORE online synthesis; the online path executes nothing from content. QA machinery (not shipped runtime): (A2) deployed-secret scanner REPAIRED + calibrated — explicit target, fail-closed, chunk-graph, credential-material; (B1) canonical qa:monster orchestrator. Priors (still shipped): Yarden spouse-of-descendant CLASS fix (corpus north-star=0); 13 red voice/STT tests resolved to server-only arch; TEMPORAL=GROUNDED+FRESH weather/FX dated + dated-search for latest-result; tool-sequencing RAW-EVENT oracle; replacement-path proofs. Do NOT merge (production serves an older build; 3 old keys await owner revocation).',
  buildDate:  '2026-08-17',
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
