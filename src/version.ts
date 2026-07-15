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
  version:    '0.92.0-spanish-relation-between',
  buildLabel: 'AbuBank — SPANISH_RELATION_BETWEEN (Intelligence Parity Cycle 13, text-only via the real ExecutiveCognitiveController): device-triage gap. ¿qué relación hay entre Anabel y Leo? fell to the LLM though the Hebrew מה הקשר בין אנבל ללאו resolves deterministically. Made the directional kinship engine bilingual: added a Spanish label map (LABEL_ES, every RelationKind), a lang param on relationOf that renders es with the Latin/canonical name (Mor es madre de Ofir), Spanish parsing in parseRelationQuery (relación entre X y Y / qué es X para Y), and routed relación-entre to the family domain. Also fixed relationOf name resolution: it now resolves Latin/alias names via findNode (its local matchNames index lacked them), so Mor/Ofir/Anabel/Leo resolve. Evidence: spanishRelationBetween.test.ts 3/3 green (CODE); family regression suites 66 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.91.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
