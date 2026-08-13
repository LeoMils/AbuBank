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
  version:    '0.219.0-history-retrieval-path',
  buildLabel: 'AbuBank 0.219.0 — FIX 3: life history and places now have a retrieval path. Her past — the childhood in Buenos Aires, the Mendoza years and the family store Casa Milstein on San Martin, the 1977 aliyah via Rome and Florence, the Ulpan Ben Yehuda in Netanya where the Omansky and Elsi/Saul friendships began, the Bat Yam years and the shop — lived as prose in martita_personality.yaml that NO tool ever read, so it was unreachable. Fix: a new authority knowledge/life_history.json (extracted faithfully from that prose and the family notes; nothing invented; unknowns kept unknown) plus a history_lookup tool that reads it and returns ONLY grounded summaries with confidence, or an honest not_found — the same discipline people_lookup gives people. Wired into the live tools and the instructions, under the provider caps. A reachability harness queries every era (Mendoza, the store, the aliyah, childhood, Bat Yam, Argentina, the Ulpan) and the honest not_found. Evidence: CODE + AUTOMATED TEST; typecheck + full suite (12,632) + build. Prior in this branch: FIX 1+2 (v0.215), FIX 4 (v0.216), FIX 7 (v0.217), FIX 5 (v0.218). Still open: FIX 6 news/cinema depth, FIX 8 audio.',
  buildDate:  '2026-08-13',
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
