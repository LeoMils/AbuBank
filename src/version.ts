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
  version:    '0.109.0-saved-memory',
  buildLabel: 'AbuBank — SAVED_MEMORY (Intelligence, text-layer): ChatGPT-style user-COMMANDED durable memory. "תזכרי ש…" (remember that) persists a fact to the PWA (durableStore: IndexedDB + localStorage mirror), loaded every session; "מה את זוכרת עליי?" recalls the saved facts; "תשכחי ש…" forgets on request — He + Es (recordá que / qué te acordás de mí / olvidate). Distinct from the passive rolling ConversationSummary. PRIVACY enforced at the write boundary: phone / medical / financial / street are refused, never stored. Handled deterministically in the runtime (new intent "memory") BEFORE the LLM, so it never punts to a model that has no store. Proven by MULTI-SESSION replays through the single runtime: session A stores → a FRESH session B recalls (the fact lives in durable, not RuntimeState) → C forgets. Evidence (CODE): savedMemory 7/7; full suite 10980 pass/2 todo; typecheck + build clean. Voice/Realtime untouched. Builds on 0.108.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
