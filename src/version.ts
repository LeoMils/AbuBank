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
  version:    '0.281.0-earonly',
  buildLabel: 'AbuBank 0.281.0 — GOLDEN-SESSION 18/18. Owner device round 2 (all 4 fixed): E3 no repetition — a card already on screen is not re-announced (deterministic) + a spoken-sentence repeat guard + instruction; E5a the presence display can NEVER contradict the session (a stale "thinking" hint no longer overrides real listening — invariant test added); E5b never explains her own internals (verified on the model: "why does it say חושבת?" → one warm human line, no system-talk); CONTACT REACHABILITY — a known-but-not-a-contact person (a care-facility resident, a Vancouver relative) is answered for who they are but NEVER offered a message/call; immediate family reachable by default, others opt-in via data. Preamble two-response still ships ON (/build-flags.json). Evidence: instrument + unit; presence/reconnect/card-dedup are CODE, spoken-repeat is instruction+observed — device re-verify pending. Do NOT merge (production serves Aug 5).',
  buildDate:  '2026-08-16',
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
