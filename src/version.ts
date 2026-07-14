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
  version:    '0.74.0-family-possessive-spouse',
  buildLabel: 'AbuBank — FAMILY_POSSESSIVE_SPOUSE: a common family question in the POSSESSIVE spouse form ("מי בעלה של אופיר" — who is Ofir’s husband, "מי אשתו של עילי" — Eili’s wife) used to punt to the LLM (risking an invented family fact), because the family reasoner + classifier matched only "הבעל של" / "האישה של", not the suffix forms "בעלה" / "אשתו". Both now recognize the possessive forms → answered from the family graph (גלעד / ירדן), never the model. Part of the CONVERSATION_GAP_MAP effort (docs/CONVERSATION_GAP_MAP.md): the controller is the sole runtime path and its grounded family coverage was weaker than the deprecated tryGroundedAnswer. Ofir feminine forms + ex-spouse directionality unchanged. Builds on 0.73.0 SPANISH_CREATE_COMPLETES.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
