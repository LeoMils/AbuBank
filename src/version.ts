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
  version:    '0.106.0-calendar-referability',
  buildLabel: 'AbuBank — CALENDAR_REFERABILITY (Intelligence, text-layer): after AbuAI creates + saves an event it becomes REFERABLE — a property question that points at it with a PRONOUN or the noun "פגישה" ("איפה אני פוגשת אותו?", "עם מי הפגישה?", "מתי אני נפגשת איתו?") is now answered from the store (the event in FOCUS), not dead-ended to the LLM. Fixes the FIRST divergence in the create→"where do I meet him"→move→cancel flow (found by driving runCognitiveTurn, mechanism-first). General gate: property-cue + focus-reference + NO other named person (a differently-named person still re-searches); leading "ו" handled for chained follow-ups; answerCalendarProperty now also answers "מתי" (date+time). Additive — only fires with a live calendar focus. Evidence (CODE): calendarReferability 6/6 (red→green, multi-turn through the single runtime); full suite 10966 pass/2 todo; typecheck + build clean. Voice/Realtime untouched. Builds on 0.105.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
