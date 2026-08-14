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
  version:    '0.253.0-bundle-plan',
  buildLabel: 'AbuBank 0.253.0 — M5 per-intent decomposition (measured, reversible). Deletion is exhausted at 13,221 always-on instruction chars; <5,000 needs a STRUCTURAL change. intentInstructions.ts decomposes the SHIPPED instructions (buildLiveInstructions UNTOUCHED, byte-identical — flag-OFF payload unchanged) into an always-on CORE + intent blocks injected only when relevant. MEASURED: core 5,886 (safety 1.3k + persona 2.2k dominate); intent blocks family 2,065, profile 1,201, tools 4,063. Projected per-turn once injection is enabled: chit-chat 5,886, family 7,951, tools 9,949 — down from 13,221 every turn. HONEST LIMIT (asserted false-today so the ledger stays truthful): core is NOT yet <5,000 — reaching it also needs condensing the persona, which trades warmth and is a DEVICE off/on measurement, not a deletion. classifySections throws on any unclassified section so no rule is ever silently dropped. Loss-less decomposition proven (intentInstructions.test 9). ON-path wiring into liveSession + startup pre-warm are the device gates. Report: docs/eval/BUNDLE_SHRINK_PLAN.md. Prior: adversarial interception (v0.252).',
  buildDate:  '2026-08-15',
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
