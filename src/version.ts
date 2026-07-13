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
  version:    '0.67.0-natural-slotfill-clarify',
  buildLabel: 'AbuBank — NATURAL_SLOTFILL_CLARIFY: during a fragmented ("drip") create, once the person is given AbuAI now asks a warm, context-aware next question ("לאיזה יום ושעה לקבוע עם מור?") instead of the bald "באיזה יום?" — which the dialogue loop-breaker used to escalate into a dead-end "say it again" reprompt. Removes the robotic mid-create reprompt on EVERY fragmented create (priority-1 natural conversation); non-ambiguous drips now flow title→day/time→confirm→save cleanly. Builds on 0.66.0 FRAGMENTED_CREATE_CONTINUITY.',
  buildDate:  '2026-07-13',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
