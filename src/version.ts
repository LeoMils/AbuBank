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
  version:    '0.185.0-live-calendar-location-fix-rc1',
  buildLabel: 'AbuBank 0.185.0 — LIVE_CALENDAR_LOCATION_FIX_RC1: fixed the LOCATION_DROPPED bug the harness proved, end to end. LiveEvent now carries location+notes; LiveTools commit passes every prepared field to the store; durableCalendarStore persists location/notes and read_calendar reads them back — nothing the model prepared is dropped on save. New real tool update_calendar_event edits an ALREADY-SAVED event IN PLACE by date (no duplicate), reusing AbuCalendar updateAppointment; instructions route committed-event edits to it, not prepare. Every draft field (title/date/time/participant/location/notes) round-trips create→confirm→persist→read→update, proven by an exhaustive deterministic liveTools test. bait over-offer fixed: instructions make Abu decline capabilities with no tool (taxi/email/reminder/…); the capability check is decline-aware. Stalling check is now Hebrew word-boundary aware (no more false positive on "רגע" inside "להירגע"). Six clarifying-question scenario LABELS corrected (asking "which doctor?" is right). Harness (gpt-4o-mini): 33→41/43 PASS; all 3 location + 3 bait scenarios GREEN. Evidence: CODE (typecheck 0; 63 harness/liveTools tests green) + a real gpt-4o-mini run. PHYSICAL_DEVICE NOT claimed.',
  buildDate:  '2026-08-10',
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
