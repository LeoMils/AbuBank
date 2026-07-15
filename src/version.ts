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
  version:    '0.95.0-memory-honesty-recall',
  buildLabel: 'AbuBank — MEMORY_HONESTY_RECALL (Intelligence Parity Cycle 16, text-only via the real ExecutiveCognitiveController): two device failures. (1) It implied it had memory (sometimes I miss things) while having none — a CROSS-SESSION memory question (את זוכרת מה אמרתי לך אתמול? / ¿te acordás de lo que te dije ayer?) now gets a deterministic HONEST reply that never implies it remembers past-session conversations (CROSS_SESSION_MEMORY_RE requires a past-session time marker so a within-session מה אמרתי קודם is not captured). (2) what was my last question had no answer — מה שאלתי אותך קודם? / ¿qué te pregunté? now recalls the prior user question from THIS session working memory (raw message history, else the last recorded question, else an honest nothing-yet), never the LLM. Both handled in the continuation case; RECALL_TOPIC + resume unaffected. Evidence: memoryHonestyRecall.test.ts 4/4 green (CODE); continuation regression suites 515 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.94.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
