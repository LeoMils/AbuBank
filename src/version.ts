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
  version:    '0.84.0-family-count-queries',
  buildLabel: 'AbuBank — FAMILY_COUNT_QUERIES (Intelligence Parity Cycle 5, text-only via the real ExecutiveCognitiveController): closes gap F6. כמה נכדים/ילדים/נינים יש ל<X> (how many grandchildren/children/great-grandchildren) punted to the LLM — there was no count reasoner and the query carries only one family name, so routing never reached the graph. Added familyCountReasoner (grandchildrenOfPublic / greatGrandchildrenOfPublic / childrenOfPublic) + routing, so כמה נכדים יש למרטיטה → יש למרטיטה 6 נכדים: אופיר, איילון, עילי, אדר, עדי ונועם; כמה נכדים יש לי (Martita self) → לך; deterministic count + grounded list, never guessed. Evidence: familyCountQueries.test.ts 4/4 green (CODE); family regression suites 246 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.83.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
