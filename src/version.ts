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
  version:    '0.86.0-meal-time-of-day',
  buildLabel: 'AbuBank — MEAL_TIME_OF_DAY (Intelligence Parity Cycle 7, text-only via the real ExecutiveCognitiveController): closes gap C4. קבעי ארוחת ערב עם אנבל ביום שישי בשמונה scheduled an 8 AM dinner — the bare hour בשמונה was flagged ambiguous and defaulted to the morning reading because ארוחת ערב (dinner) was not a recognized period hint (PERIOD_PM matched only בערב/הערב, not the bare meal noun). Added meal-context period hints: ארוחת ערב/ארוחת צהריים/דינר → PM, ארוחת בוקר → AM, so a bare hour resolves from the meal (dinner → 20:00). A truly bare hour with no meal/period context stays ambiguous (asks בבוקר או בערב), unchanged. Evidence: mealTimeOfDay.test.ts 4/4 green (CODE); calendar regression suites 150 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.85.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
