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
  version:    '0.71.0-family-ex-spouse-directionality',
  buildLabel: 'AbuBank — FAMILY_EX_SPOUSE_DIRECTIONALITY: Martita can now ask about an ex-spouse in BOTH directions and get a deterministic graph answer instead of an LLM guess. "מי הגרוש של מור" → רפי, "ממי מור גרושה" → רפי, and the reverse "רפי הוא הגרוש של מי" → מור. Before, these fell through to a profile-blurb lookup (or the LLM); now answerFamilyRelation resolves the symmetric ex-spouse edge from knowledge/family_data.json (Mor↔Rafi), rendered "הגרוש/ה של X". Current-partner ("מי בת הזוג של מור" → יעל) and Ofir feminine forms are unchanged. Builds on 0.70.0 SPANISH_CREATE_STAYS_SPANISH.',
  buildDate:  '2026-07-14',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
