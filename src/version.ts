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
  version:    '0.113.0-referable-fix',
  buildLabel: 'AbuBank — REFERABLE_FIX (Intelligence, text-layer): PREVIEW-verified fix for calendar referability. A Playwright typed-script run on the deployed 0.112.0 preview caught "cancel it"/"where do I meet him" falling to the LLM: the pronoun was resolved to a person NAME across FOUR layers (UI resolvePronouns/resolveFollowUp/companion-continuity + the runtime normalizeInput), and feminine "אותה" mis-resolved to a stale female name ("ארי") ignoring the focused (male) event. Fixes: (1) the UI skips its pronoun/follow-up rewrite while a calendar event is in focus; (2) the runtime keeps a referential-pronoun turn RAW under a calendar focus so normalizeInput no longer mis-resolves it; (3) isFocusPropertyQuery also binds a property question that NAMES the focus person. Result: create→"where do I meet him"→"cancel it" is deterministic (~330ms), 13/13 on the live preview. Evidence: PREVIEW (Playwright on the deployed build) + CODE (calendarReferability regressions); full suite 10988 green; typecheck+build clean. Note: the 0.112.0 RUNTIME_OWNED/cogFocusRef edits were in DEAD code (live path is ExecutiveController→runFullTurn→runCognitiveTurn); the duplicate-handler removal stands. Voice/Realtime untouched. Builds on 0.112.0.',
  buildDate:  '2026-07-16',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
