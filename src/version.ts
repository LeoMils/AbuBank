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
  version:    '0.100.0-backward-date',
  buildLabel: 'AbuBank — BACKWARD_DATE (Intelligence Parity Cycle 21, text-only via the real ExecutiveCognitiveController): wide-probe gap — איזה יום היה לפני שבוע fell to the LLM. dateReasoner did FORWARD arithmetic (בעוד N ימים/שבוע) but not BACKWARD. Added lifneiDaysOffset (לפני N ימים/יומיים/שבוע/שבועיים/N שבועות → a backward day offset) + extended RELATIVE_DATE_QUERY_RE to route לפני questions to date_query. now Wed 2026-07-15: איזה יום היה לפני שבוע → יום רביעי, 8 ביולי; לפני יומיים → יום שני, 13 ביולי; לפני 3 ימים → 12 ביולי. Forward בעוד arithmetic is unchanged. Evidence: backwardDate.test.ts 5/5 green (CODE); date regression suites 122 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.99.0. (0.100 continues the 0.x foundation sequence — not a 1.0 GA.)',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
