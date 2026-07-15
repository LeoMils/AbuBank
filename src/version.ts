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
  version:    '0.94.0-civic-holiday-online',
  buildLabel: 'AbuBank — CIVIC_HOLIDAY_ONLINE (Intelligence Parity Cycle 15, text-only via the real ExecutiveCognitiveController): device failure — wrong Independence Day (gave 2024, then a past date). National/civic days (יום העצמאות/חג העצמאות, יום הזיכרון, יום השואה, יום ירושלים, Spanish día de la independencia) are NOT in the deterministic religious-holiday table and their Gregorian date is nidche-adjusted (postponement rules), so answering from model memory or a table would risk inventing a wrong date. Worse, באיזה תאריך יום העצמאות matched date_query and returned TODAY (confidently wrong), and מתי חג העצמאות / the Spanish form fell to the LLM. Added CIVIC_HOLIDAY_RE and routed these to LIVE retrieval BEFORE date_query and before the LLM fallback — never a hallucinated/past date; the deterministic religious holidays (ראש השנה/פסח) and relative dates (אתמול) are NOT hijacked. Evidence: civicHolidayOnline.test.ts 7/7 green (CODE); date + online regression suites 70 green; full suite green. NOTE: the exact returned date is the LIVE provider (PREVIEW-class); deterministic nidche computation intentionally NOT hardcoded to avoid inventing dates. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.93.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
