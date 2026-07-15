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
  version:    '0.103.0-days-until',
  buildLabel: 'AbuBank — DAYS_UNTIL (Intelligence Parity Cycle 24, text-only via the real ExecutiveCognitiveController): wide-probe gap — כמה זמן עד סוף החודש fell to the LLM. Added daysUntilAnswer (deterministic from ctx.now + the Hebrew-holiday table) for end-of-month, end-of-week (Israel week ends Saturday), and a religious holiday (ראש השנה/פסח/…). now Wed 2026-07-15: עד סוף החודש נשארו 16 ימים; עד סוף השבוע נשארו 3 ימים; עד ראש השנה נשארו 69 ימים (22 בספטמבר 2026). New DAYS_UNTIL_QUERY_RE routes these to date_query. Civic days (יום העצמאות) still go online (nidche, not in the table); a birthday days-until is not yet wired (needs the birthday lookup). Evidence: daysUntil.test.ts 4/4 green (CODE); date regression suites 57 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.102.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
