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
  version:    '0.78.0-spanish-family-identity',
  buildLabel: 'AbuBank — SPANISH_FAMILY_IDENTITY: CONVERSATION_GAP_MAP G2. A Spanish family identity question ("quién es Mor" / "quién es Ofir") used to be classified general and PUNTED to the LLM (risking an invented family fact), even though the graph could answer it in Spanish. Now the classifier recognizes "quién es <known family name>" as family and familyReasoner answers from the graph in the query language via describeRelation(...,"es") → "Abu es madre de Mor" / "Abu es abuela de Ofir (a través de Mor)". Threaded lang through the family case (settle es-compose, es unknown-fallback). Hebrew "מי זאת אופיר" + ex-spouse/possessive/Ofir feminine unchanged. Asserted through the real controller (source!==llm). Builds on 0.77.0 MEMORY_HONESTY.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
