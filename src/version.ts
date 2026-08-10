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
  version:    '0.186.0-live-honesty-guard-rc1',
  buildLabel: 'AbuBank 0.186.0 — LIVE_HONESTY_GUARD_RC1: capability audit (Part A) then the honesty foundation (Part B item 1). Removed from abu-persona.md AND the live instructions every capability Abu IMPLIED but has no tool for: current information / news, weather today, memory across sessions (each call starts fresh), the cinema check, and games. The instructions now explicitly disclaim these. New instructions-vs-tools gate guard (auditInstructionsVsTools) fails qa:production-gate if a claim phrase reappears or a required disclaimer goes missing — wired as an always-on report test + the wrapper now propagates a nonzero exit; unit tests prove it has teeth. SCOPE HONESTY: this build lands only the audit + honesty removal + guard. The action-card overlay (whatsapp_draft/phone_call/calendar cards) and the four device defects + flight-recorder export are NOT in this build. Evidence: CODE (typecheck 0; liveInstructions guard tests green). PHYSICAL_DEVICE NOT claimed.',
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
