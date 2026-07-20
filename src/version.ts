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
  version:    '0.145.0-calendar-journey-audit',
  buildLabel: 'AbuBank — CALENDAR_JOURNEY_AUDIT (INTAKE REBUILD, session 6 · P4). Audited the calendar state machine as FULL journeys (permanent regression, src/screens/AbuAI/calendarJourney.test.ts): create→query→edit→delete→recreate each round-trips through the real store; MULTIPLE meetings with the same person are allowed and stay distinguishable; a created event carries the RESOLVED name ("עם החתן של מור" stored as "פגישה עם גלעד"). Plus a STANDING capability-denial probe: read/search/edit/delete paths are scanned and a "לא יכולה / אי אפשר / can\'t" phrase on any existing path is a HARD test failure (an empty calendar still answers honestly, "אין כלום ביומן", never a denial). Test-only audit — no runtime change. Evidence: CODE — journey 4/4 + FULL suite 11516 pass / 2 todo / 0 regressions, typecheck + build. NOT device-proven; only the Leo free-language round decides readiness. NEXT: P5 ledger intake width → P6–P8 → verification regime. Builds on 0.144.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
