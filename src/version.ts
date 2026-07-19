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
  version:    '0.129.0-day-and-stale-guard',
  buildLabel: 'AbuBank — DAY_AND_STALE_GUARD (Cycle 49 — triage of Leo stale-round failures + stale-build guard). Leo verification round ran on a 49-versions-stale cached build (0.79.0), not 0.128. Imported the observed turns as PERMANENT regressions (leoStaleRoundRegression.test) after replaying against the CURRENT app entry. TRIAGE: already fixed 0.79→0.128 — family contradiction (עדי/נועם answer as BROTHERS deterministically, no invented בן דוד), relation-phrase create (אח של נועם → עדי), in-law chain (מה הקשר בין ירדן לנועם → via עילי). STILL reproduced + NOW FIXED (RED-first): calendar which-day/when. A saved meeting queried באיזה יום / מתי הפגישה returned only the hour, a location dead-end, or the LLM. Root: CAL_PROPERTY_RE + CAL_PROP_CUE did not match באיזה יום / מתי הפגישה, and answerCalendarProperty had no day branch (מתי gave date without the weekday). Fix (cognitiveRuntime.ts): route those turns to the property path and answer DAY + DATE + TIME via safeHebrewDate (ביום שני, 20 ביולי 2026 בשעה 15:00); a pure hour question still answers the hour. STALE-BUILD GUARD: services/versionSync existed but was wired NOWHERE (dead code) — mounted it as a calm StaleBuildBanner in App that fetches /api/health and, on a version mismatch with this bundle, offers a one-tap refresh; typed-script gained Step 0 (verify the QA badge = expected version, else STOP). Evidence: CODE — leoStaleRoundRegression 5/5, StaleBuildBanner 3/3, full suite + typecheck + build. Builds on 0.128.0.',
  buildDate:  '2026-07-19',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
