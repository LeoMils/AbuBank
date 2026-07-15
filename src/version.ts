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
  version:    '0.99.0-time-in-city',
  buildLabel: 'AbuBank — TIME_IN_CITY (Intelligence Parity Cycle 20, text-only via the real ExecutiveCognitiveController): wide-probe confidently-wrong bug — מה השעה בניו יורק returned the LOCAL Israel clock (10:00) instead of New York time. The TIME branch ignored the city. Added a CITY_TZ map (New York, Buenos Aires/Argentina, London, Paris, Madrid, Barcelona, Los Angeles, Miami, Moscow, Berlin, Rome, Tokyo, Sydney, Dubai; He + Es names) and timeInCity, which formats ctx.now with Intl.DateTimeFormat({timeZone}) — deterministic regardless of the runner TZ. He: בניו יורק השעה עכשיו HH:MM; Es: En Nueva York son las HH:MM. Unknown cities fall through to the local clock honestly; a bare מה השעה is unchanged. Evidence: timeInCity.test.ts 5/5 green (CODE); date + time regression suites 50 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.98.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
