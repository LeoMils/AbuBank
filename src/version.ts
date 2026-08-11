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
  version:    '0.208.0-defect1-no-preambles',
  buildLabel: 'AbuBank 0.208.0 — device defect 1 (no preambles / no repeated openers): stripped the seeded filler menu from abu-persona.md (the explicit list of openers such as the standalone טוב that the model was reciting before every lookup) and strengthened the no-announce rule so the first words out of her mouth are the answer itself. Added a TOOL-AGNOSTIC runtime guard test: every owned live tool must emit exactly one response.create in the same turn (iterating LIVE_TOOL_NAMES, so a future tool that forgets to speak fails). Added two text-harness assertions: REPEATED_OPENING_PHRASE (the same two-word opener may not repeat more than twice in a long conversation) and ANNOUNCED_CHECK (announcing a check that a tool then performs in the same turn), plus tightened the tool-before-speech comment/enforcement. Evidence: CODE + AUTOMATED TEST (harness + liveTools green); on-device phrasing is HUMAN-EYE, re-checked via the report harness.',
  buildDate:  '2026-08-11',
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
