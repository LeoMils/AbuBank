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
  version:    '0.117.0-ramble-date',
  buildLabel: 'AbuBank — RAMBLE_DATE (Reality-driven — Leo device #2): a rambling create with a CONTEXT date and a MEETING date ("דיברתי היום… להיפגש מחר בשלוש") now picks the MEETING date — parseCreateDate chooses the day cue NEAREST the time expression (a meeting date + time are stated together), instead of the first "היום". Structural proximity rule, NOT a phrase list; a single date cue is unchanged. Together with 0.116.0 (relation-phrase person → גלעד) this closes the rambling-story failure end-to-end: person, location, AND date correct. Also fixed a lookbehind bug (prefix ל/ב in "להיום") surfaced by the device-transcript regression. Evidence: CODE (calendarRelationPhrase story asserts date=מחר; realDeviceTranscriptRegression 32/32; calendarCrudGeneralization 4/4) + APP-level re-verify on a fresh preview; full suite 11015 green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.116.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
