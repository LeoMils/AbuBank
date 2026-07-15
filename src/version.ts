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
  version:    '0.81.0-why-knowledge-not-frustration',
  buildLabel: 'AbuBank — WHY_KNOWLEDGE_NOT_FRUSTRATION (Intelligence Parity Cycle 2, text-only via the real ExecutiveCognitiveController): a general why-is-X knowledge question (למה השמיים כחולים) was mis-routed to a frustration CHALLENGE reply (an apology, לא הייתי מספיק ברורה) because WHY_RE began with ^למה(?![א-ת]) — matching ANY input starting with למה. Narrowed WHY_RE so bare למה? and the specific challenge phrasings (למה לא קבעת / למה אין לך / למה אצלך) stay challenges, while why-topic questions fall to the general/LLM path and are actually answered. Evidence: whyKnowledgeVsChallenge.test.ts 5/5 green (CODE); targeted challenge suites 318 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.80.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
