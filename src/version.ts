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
  version:    '0.107.0-weekday-read',
  buildLabel: 'AbuBank — WEEKDAY_READ (Intelligence, text-layer): a calendar read for a NAMED weekday ("מה יש לי ביום חמישי?", "בשבת") now resolves to the NEXT occurrence of that weekday and reads it, instead of silently reading TODAY and answering "אין כלום" while a real event sits on that day — divergence #3 in the referable-CRUD flow (a read that hides a real event is a dead-end). Honest empty ("ביום שישי אין כלום") preserved. Scoped to calendarReadReasoner; other reads (היום/מחר/מחרתיים/השבוע) unchanged. Evidence (CODE): calendarNamedWeekdayRead 2/2 + calendarReferability 6/6 (red→green through the single runtime); full suite 10968 pass/2 todo; typecheck + build clean. Voice/Realtime untouched. Builds on 0.106.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
