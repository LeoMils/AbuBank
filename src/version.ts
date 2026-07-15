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
  version:    '0.91.0-calendar-midnight',
  buildLabel: 'AbuBank — CALENDAR_MIDNIGHT (Intelligence Parity Cycle 12, text-only via the real ExecutiveCognitiveController): the exact device failure — פגישה עם אופיר מחר בחצות בקפה אילנה asked באיזו שעה even though בחצות (midnight) was already said, and the no-verb form fell to the LLM. parseHebrewTimeDetailed did not resolve בחצות, and בחצות was not a narrative time-cue. Added: בחצות/חצות/חצות הלילה → 00:00 and חצות היום → 12:00 in the create time parser, and בחצות to the narrative TIME_CUE. Now פגישה עם אופיר מחר בחצות בקפה אילנה → calendar_create with person=אופיר, place=קפה אילנה, time=00:00, no re-ask (both with and without a create verb). Evidence: calendarMidnight.test.ts 4/4 green (parser + real controller); calendar regression suites 130 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.90.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
