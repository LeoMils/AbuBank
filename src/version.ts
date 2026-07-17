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
  version:    '0.119.0-marathon-wide',
  buildLabel: 'AbuBank — MARATHON_WIDE (Cycle 39 — widen the generative marathon to 1200 sessions × 8 scenario classes): added relation-phrase creates ("פגישה עם ה<rel> של <person>" saves the RESOLVED person), "the last one" referable-cancel chains, mid-flow person corrections, and Spanish (Rioplatense) calendar sessions. The wide batch surfaced 4 break classes; fixed 3 general mechanisms: (1) ES REFERABLE DELETE — "cancelalo/borrá/eliminala" on a SAVED event dead-ended to the LLM (Hebrew-only referential-delete gate); added a Rioplatense mirror so it routes to the deterministic delete. (2) FOCUS-PROPERTY PRECISION — "איפה אני פוגשת אותו?" answered from the OLDEST same-person event; now takes the most-recently-created match (the referent just set up), so an older no-location meeting no longer shadows the fresh one. (3) PERSON-NAME TRUNCATION — extractPerson bare ב/ל/על prefix-stop truncated any name starting with ל/ב (לאו, לאה, לירון) and the genitive target after "של"; split hard-stops from the prefix-stop and exempted the first person word + post-"של" targets. Evidence (CODE at app-entry level): generativeMarathon 1200/1200 clean; full suite green; typecheck+build clean. Voice/Realtime untouched. Builds on 0.118.0.',
  buildDate:  '2026-07-17',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
