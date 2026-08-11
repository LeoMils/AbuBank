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
  version:    '0.197.0-family-out-of-prompt-rc1',
  buildLabel: 'AbuBank 0.197.0 — FAMILY_OUT_OF_PROMPT_RC1 (D4): the family data is physically removed from the live instructions — the model now gets every family/people fact from the people_lookup tool (M3), not from embedded prose. The "# What Abu Knows — Family" section and the abu-family.md embed are gone; a short "# Family and People" routing instruction replaces them (call people_lookup for who / relationship / relatives / contact; never guess a name, gender, date or relationship; a phone number is never read aloud). The resolve_contact references in the instructions are replaced by people_lookup. Instruction size: 12978 → 9962 chars (−23%; the pure-removal floor is 9587, plus the people_lookup routing paragraph). abu-family.md remains only as legacy prose, no longer in the prompt; generating it FROM the one source is still staged. Also fixes a version-label sync bug from 0.196.0 (an apostrophe in that label truncated the health.ts BUILD_LABEL regex). Evidence: CODE + AUTOMATED TEST (instruction tests updated to the new structure; familyReconciliation + sharedConstruction green; full suite green; typecheck 0; build 0). On-device family speech via people_lookup is PHYSICAL_DEVICE — NOT claimed.',
  buildDate:  '2026-08-10',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  // DIAGNOSTIC-INTEGRITY: the real deployed commit SHA is injected at build time
  // (Vercel VERCEL_GIT_COMMIT_SHA → VITE_COMMIT_SHA). Falls back to 'local' only for
  // a local dev build. Fixes the device-falsified `commit=local` in live diagnostics.
  commitHint: (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_COMMIT_SHA) || 'local',
} as const

export type AppVersion = typeof APP_VERSION

/**
 * A compact, screenshot-friendly build fingerprint. Rendered in the corner of the
 * live Abu overlay so any screenshot PROVES which build actually ran on the device
 * (version + real commit SHA). Not a secret — build identity only.
 */
export const BUILD_ID = `${APP_VERSION.version}·${APP_VERSION.commitHint}`
