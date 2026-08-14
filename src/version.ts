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
  version:    '0.242.0-care-memory-refine',
  buildLabel: 'AbuBank 0.242.0 — care + memory refinements (convergence v3, issues i/ii/iii from the last wave). (iii) careGuard.safeCareResponse now ROTATES the wording across calls (2-3 variants per risk/lang) so a daily medication question does not read as a machine — the safety CONTENT (point to a real person, Mada 101 for urgent, never advice/dose) is identical across every variant (asserted for all four risks). (ii) the memory-tool sensitive decline now reports EXACTLY which category is kept private (phone/medical/financial/street) and is FORBIDDEN from ever saying she cannot update anything (the original defect) — a death still persists, it is not medical. (i) saved-memory injection is now BOUNDED to a hard char budget (1200 in the live session), recency-first (newest-first even on same-millisecond ties), with an honest note about older facts kept but not shown — so it cannot fight the coming instruction-bundle shrink. Tests +9 (careGuard variants + memory decline detail + injection budget). typecheck + full suite + build + mutation green. Prior: live memory (v0.241).',
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
