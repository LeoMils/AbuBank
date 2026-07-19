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
  version:    '0.130.0-calendar-search-day',
  buildLabel: 'AbuBank — CALENDAR_SEARCH_DAY (Cycle 50 — Leo full stale-round export replayed + locked). Ran Leo 20-turn stale-round export through the importer against the CURRENT build. Most turns were already fixed 0.79→0.129 (family brothers deterministic, relation-phrase create → עדי, in-law chain). The CATASTROPHE ROOT still reproduced and is NOW FIXED (RED-first): the calendar SEARCH path. Martita asked WHICH DAY her meeting was and got only the hour, repeatedly. calendarSearchReasoner grabbed only the first word after עם ("החתן") and never resolved the relation phrase, so after the create correctly resolved to גלעד the search could not even FIND the event she just made ("אין לך פגישה עם החתן"); and formatEventNatural emitted no day/date (emoji+title+hour only). Fix (cognitiveRuntime.ts calendarSearchReasoner): capture the WHOLE person phrase after עם/אצל, resolve it via resolvePersonPhrase (החתן של רפי → גלעד), search resolved-then-raw-then-first-word, and answer DAY + DATE + TIME via safeHebrewDate (פגישה עם גלעד ביום שני, 20 ביולי 2026 בשעה 21:00). Locked EVERY stale-round turn as permanent regressions incl. a full 20-turn crash-free/finalized/no-fabricated-contradiction replay (leoStaleRoundRegression.test, 8/8). Note: "אח של נועה" stays literal because נועה is not in the family graph (correct — no fabrication). Evidence: CODE — leoStaleRoundRegression 8/8, calendar/parity suites green, full suite + typecheck + build. Builds on 0.129.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
