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
  version:    '0.116.0-relation-phrase-create',
  buildLabel: 'AbuBank — RELATION_PHRASE_CREATE (Reality-driven — Leo device #1): a calendar create that names a person by a RELATION PHRASE ("פגישה עם החתן של רפי") now resolves it to the REAL person (גלעד) via the family engine BEFORE scheduling — not saved literally. New personPhraseResolver composes graph edges for any relation incl. in-laws (חתן/כלה/חם/חמות/גיס/גיסה); unambiguous only, honest null on unknown/ambiguous. Wired into runCognitiveTurn calendar_create (covers the smart + base parser paths + rambling stories, which also keep the real location e.g. בית קפה טולדנו). RED-first reproduced at APP level on the deployed preview (Playwright); fix proven at runtime + re-verified on a fresh preview. Evidence: CODE (personPhraseResolver 9/9 + calendarRelationPhrase 3/3) + PREVIEW; full suite 11015 green; typecheck+build clean. Remaining from the story: date grabbed from ramble context ("היום" vs "מחר" for the meeting) — next cycle. Voice/Realtime untouched. Builds on 0.115.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
