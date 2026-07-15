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
  version:    '0.85.0-online-cache-per-query',
  buildLabel: 'AbuBank — ONLINE_CACHE_PER_QUERY (Intelligence Parity Cycle 6, text-only): the online stale-while-revalidate cache keyed answers by the COARSE queryKind (general_current / news / sports / …), so two DIFFERENT questions of the same kind within the 30-min TTL returned the SAME cached answer — the repeated-identical-answers-to-different-questions symptom, reproduced in CODE at the provider boundary (mi rosh hamemshala vs mi nasi arhab both map to general_current). Fixed answerOnlineCurrentInfo to key the cache by kind + the specific normalized query, so an identical repeat still hits the cache but two different questions never share an answer. Also verified (separately) that the ExecutiveCognitiveController online ROUTING is already clean: consecutive different online turns each call the tool with their own query and return their own answer. Evidence: onlineCacheCollapse.test.ts 2/2 + onlineStaleAnswerProbe 1/1 + onlineProvider.test.ts green (CODE); full suite green. NOTE: end-to-end live grounding remains PREVIEW-class (needs a real provider call). Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.84.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
