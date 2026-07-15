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
  version:    '0.96.0-next-weekday',
  buildLabel: 'AbuBank — NEXT_WEEKDAY (Intelligence Parity Cycle 17, text-only via the real ExecutiveCognitiveController): a widened probe surfaced that איזה תאריך יום שלישי הבא matched date_query and returned TODAY (confidently wrong) and מתי יום ראשון הבא fell to the LLM. dateReasoner handled relative words + N-day/hour arithmetic but not יום <weekday> הבא. Added nextWeekdayAnswer (next occurrence of a weekday strictly after today; if today IS that weekday, next weeks) + NEXT_WEEKDAY_QUERY_RE routing that requires a date-asking frame (מתי/איזה תאריך/איזה יום) so a create (תקבעי פגישה ביום שלישי הבא) is NOT hijacked. Fixed a latent bug: the routing regex used an ASCII word-boundary anchor after a Hebrew frame (which never matches there), so the מתי forms had silently fallen to the LLM. now Wed 2026-07-15: מתי יום ראשון הבא → 19 ביולי, איזה תאריך יום שלישי הבא → 21 ביולי, מתי שבת הבאה → 18 ביולי. Evidence: nextWeekday.test.ts 5/5 green (CODE); date + calendar regression suites 117 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.95.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
