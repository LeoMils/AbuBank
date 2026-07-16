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
  version:    '0.108.0-referable-mutation',
  buildLabel: 'AbuBank — REFERABLE_MUTATION (Intelligence, text-layer): completes the referable-CRUD flow. "תבטלי אותה" / "cancel it" (a pronoun cancel with no noun) used to classify as general → needsLLM → dead-end, leaving the event un-deleted; now, when a calendar event is in FOCUS, a referential cancel/delete verb routes to calendar_delete and removes the focused event (isReferentialDelete, gated on focus, plugin match broadened). "move it" / "cancel it" resolve their target via the focus (fallback: last appointment); the UPDATE readback is now a human Hebrew date ("28 ביוני 2026, יום ראשון") instead of raw ISO. Evidence (CODE): calendarReferableMutation 4/4 (red→green through the single runtime + real store: move→friendly date, cancel-it single + two-event, cancel-the-last-meeting); full suite 10972 pass/2 todo; typecheck + build clean. Voice/Realtime untouched. Builds on 0.107.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
