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
  version:    '0.80.0-relative-date-and-holiday-reasoning',
  buildLabel: 'AbuBank — RELATIVE_DATE_HOLIDAY_REASONING (Intelligence Parity Cycle 1, text-only via the real ExecutiveCognitiveController, no microphone): dateReasoner now answers relative day/date questions (אתמול/שלשום/מחר/מחרתיים, Hebrew + Spanish ayer/mañana) and next-holiday questions (מתי החג הבא / מתי פסח הבא) DETERMINISTICALLY from ctx.now + the fixed Hebrew-holiday table. Previously it returned TODAY for a yesterday/tomorrow question (confidently wrong) or punted relative-day and holiday questions to the LLM, which has no clock and produced the stale Independence-Day hallucination. New RELATIVE_DATE_QUERY_RE + HOLIDAY_QUERY_RE route these to date_query; the calendar read path (מה יש לי מחר) is untouched. Evidence: relativeDateReasoning.test.ts 8/8 green (CODE). Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime unchanged and deferred. Builds on 0.79.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
