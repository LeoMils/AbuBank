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
  version:    '0.88.0-relative-date-time-arithmetic',
  buildLabel: 'AbuBank — RELATIVE_DATE_TIME_ARITHMETIC (Intelligence Parity Cycle 9, text-only via the real ExecutiveCognitiveController): an expanded probe (intelligenceGapProbe2) surfaced that dateReasoner handled fixed offset WORDS (אתמול/מחר/שלשום/מחרתיים) but not ARITHMETIC — בעוד שלושה ימים returned TODAY (confidently wrong), בעוד שבוע fell to the LLM, and מה השעה בעוד שעתיים returned the current time (10:00, not 12:00). Added beodDaysOffset (בעוד N ימים/יומיים/שבוע/שבועיים/N שבועות → forward date) + beodHoursOffset (בעוד N שעות/שעה/שעתיים → clock + N hours), both deterministic from ctx.now, and extended RELATIVE_DATE_QUERY_RE to route בעוד questions to date_query. Evidence: relativeDateArithmetic.test.ts 6/6 green (CODE); date regression suites 31 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.87.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
