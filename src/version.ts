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
  version:    '0.93.0-top-scorer-online',
  buildLabel: 'AbuBank — TOP_SCORER_ONLINE (Intelligence Parity Cycle 14, text-only via the real ExecutiveCognitiveController): device failures — who is the top scorer was not answered, and a follow-up ומי מלך השערים after a sports answer fell to the LLM. The sports online detector required explicit context (מונדיאל/כדורגל/…) and did not recognize מלך השערים (top scorer) / מי הבקיע (who scored) on their own, so a bare top-scorer question was answered from model memory instead of a real retrieval. Added מלך השערים / מלכת השערים / מי הבקיע / הכובש המוביל to ONLINE_HE_SPORTS, so a standalone or follow-up top-scorer question routes online. Evidence: topScorerOnline.test.ts 3/3 green (CODE); online regression suites 116 green; full suite green. NOTE: whether the LIVE provider returns a correct top scorer remains PREVIEW-class. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.92.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
