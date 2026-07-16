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
  version:    '0.110.0-memory-injection',
  buildLabel: 'AbuBank — MEMORY_INJECTION (Intelligence, text-layer): durable saved memories are now loaded into the general-chat LLM system context every session (BOTH the streaming and tool-call build sites in service.ts), alongside the existing ConversationSummary — so an open question can use a remembered fact ("she loves red wine") instead of only the deterministic recall. formatSavedMemoriesForLLM builds a labelled system block from loadMemories(); empty when nothing is stored. Real grounding, not fabrication — the honesty rules are unchanged. Evidence (CODE): savedMemory 9/9 (formatter + BOTH-site source-contract); full suite 10982 pass/2 todo; typecheck + build clean. Voice/Realtime untouched. Builds on 0.109.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
