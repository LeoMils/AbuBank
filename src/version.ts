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
  version:    '0.247.0-qa-m3-m1',
  buildLabel: 'AbuBank 0.247.0 — QA run Part 1: M3 (family never-null) closed, M1 (dead anti-preamble text) removed. M3: people_lookup returned relationToMartita null for Gilad (husband of Ofir, a granddaughter of Martita) so an 81-year-old had to name her own grandson-in-law — a circular-testing miss (the family tests asserted against the same dataset they read). Fix: added the grandchild_in_law term (one marriage hop) and wired describePathBetween as the whoIs fallback, so a connected entity is NEVER null; generated FAMILY_GROUND_TRUTH.md (65 people, 0 gaps, 0 not_found pairs) as the independent oracle; relationNeverNull.test asserts it at 100 percent (Layer 1, all entities). M1: deleted the Before-a-Tool-Call instruction (a device trace showed it disobeyed on every tool call — an instruction does not enforce silence; the real fix is structural in the session layer and device-verified); kept the instantAcknowledgement code-seed guard; did NOT flip LIVE_INTERRUPT_RESPONSE (it is false on purpose, an echo-truncation device fix). Instructions 13,855 to 13,221 chars; payload to 25,521. Audit in BRIEF_AUDIT.md; misses in QA_MISSES.md (2, each with a closing check); owner ear-only items in OWNER_CHECKLIST.md. Gates: typecheck 0, full suite 12,769 passed, build ok. Prior: first-wins price (v0.246).',
  buildDate:  '2026-08-14',
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
