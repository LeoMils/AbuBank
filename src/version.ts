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
  version:    '0.233.0-lifecycle-wired',
  buildLabel: 'AbuBank 0.233.0 — O-LIFECYCLE WIRED into the live realtime session (H-WIRE done). RealtimeVoiceSession now drives sessionLifecycle each ~2s tick: ~12s silence pauses the upstream mic track (cost, reversible), ~25s speaks one warm response.create (את שם), ~45s speaks the goodbye then closes AFTER response_done (never mid-utterance), 20-min single outward nudge; user speech_started resets the clocks and resumes upstream; NEVER acts mid-task (responseLeased OR a calendar draft in DRAFTING/AWAITING_CONFIRM via new CalendarDraftController.hasActiveDraft). Deterministic wiring test via injectForTest + injected clock (realtimeVoiceLifecycle.test.ts 5/5). No regression: realtime+voice 139/139. Evidence class CODE (WebRTC/audio is device-only) — the idle-cost + audible goodbye still need device proof. Prior: lifecycle core (v0.232).',
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
