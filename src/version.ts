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
  version:    '0.254.0-lookup-cue',
  buildLabel: 'AbuBank 0.254.0 — M4 non-verbal in-flight cue. A live/current-info lookup has a real network wait; M1 forbids WORDS before the answer, so a silent wait can read as frozen. Now a get_current_info lookup pulses onLookup (liveSession, observation-only, deduped by call_id) → the Live screen plays a soft two-note tone (soundLookup, self-gated, silent while she speaks) AND shows a distinct honest word "מחפשת…" reusing the thinking aura (no new visual). Cleared on the next state transition, exactly like the thinking hint; her speaking always wins so the word never lies she is still searching. Family/contact lookups are silent-grounded and do NOT cue. CODE evidence: liveSession.test (pulse on get_current_info only, no double-pulse), presenceState.test (מחפשת… word + speaking wins), sounds.test (fail-silent). Audibility + on-screen render are DEVICE evidence (OWNER_CHECKLIST #6). Prior: bundle decomposition (v0.253).',
  buildDate:  '2026-08-15',
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
