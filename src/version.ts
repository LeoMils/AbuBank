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
  version:    '0.77.0-memory-honesty',
  buildLabel: 'AbuBank — MEMORY_HONESTY: P0 #2 (trust). On device AbuAI verbally implied it has memory it lacks ("sometimes I miss things"). Truth of the wiring: the current conversation IS passed to the model (fullTurnBridge → sendMessage(messages)) so it can reference what was just said, but there is NO cross-session memory. The system prompt now forbids implying a persistent/fallible memory: it must never say "שכחתי" / "לפעמים אני מפספסת"; anything not said in THIS conversation → honest "לא יודעת / לא סיפרת לי"; what WAS said this conversation → remember and continue. Regression memoryHonesty (source-contract on SYSTEM_PROMPT). Evidence: CODE; the felt honest behavior is LLM/DEVICE-observable. Builds on 0.76.0 IOS_WHISPER_STT_WATCHDOG.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
