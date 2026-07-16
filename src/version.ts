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
  version:    '0.111.0-memory-ui-wired',
  buildLabel: 'AbuBank — MEMORY_UI_WIRED + typed test script (Intelligence, text-layer): the deployed UI (index.tsx) now routes the "memory" intent through the cognitive runtime (added to RUNTIME_OWNED), so durable saved-memory turns ("תזכרי ש…" / "מה את זוכרת עליי" / "תשכחי") actually reach the handler in the app instead of falling to the LLM. Ships docs/LEO_TYPED_TEST_SCRIPT.md — ~30 numbered bilingual typed checks with verified expected answers, each labelled by SOURCE (runtime / legacy-UI / LLM / online). HONESTLY documents a wiring gap: focus-dependent referable calendar reads + pronoun mutations (cycles 26/28) are runtime-proven but index.tsx still uses duplicate handlers and does not thread focus, so they are NOT yet reachable in the app — the next cycle is the UI cutover to one runtime path. Evidence (CODE): savedMemory 10/10 (incl. an index.tsx RUNTIME_OWNED source-contract); full suite 10983 pass/2 todo; typecheck + build clean. Voice/Realtime untouched. Builds on 0.110.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
