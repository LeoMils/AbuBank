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
  version:    '0.213.0-realtime-instructions-cap',
  buildLabel: 'AbuBank 0.213.0 — the device blocker string_above_max_length is fixed. Abu connected (gpt-realtime-2.1) and then died because the assembled session instructions had grown to 13,583 chars after the 68-person knowledge update, over the provider max-length for the instructions field, so the whole session.update was rejected. Fix (not blind truncation): the per-person pronunciation enumeration left the prompt and became one compact RULE (read every Latin spelling as Spanish — each spoken form now travels with people_lookup); knowledge/abu-knowledge.md was trimmed to lean personality (the enumerated Argentine friends, the red-wine family list and the pronunciation examples all live behind people_lookup); and duplicated operational prose between the persona and the frame was de-duplicated (the frame stays authoritative). Result: assembled instructions 13,583 → 9,478 chars; the ACTUAL sent string (instructions + today line) 9,656 — a 29% cut, under the last proven-working ~9,587 in spirit and well under the enforced cap. A build-time guard (assertInstructionsWithinLimit, REALTIME_INSTRUCTIONS_MAX = 10,000) now FAILS the build/import with the measured size if instructions ever exceed the cap, checked on the exact string buildSessionUpdate sends; a harness assertion covers the same shared string. The 10,000 ceiling is empirical (no published char cap found): 13,583 rejected on device, ~9,587 last known-good. Evidence: CODE + AUTOMATED TEST (liveInstructions + harness guards green; full suite + build). Not device-proven that voice now stays up — requires a physical reconnect on the deployed build.',
  buildDate:  '2026-08-12',
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
