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
  version:    '0.279.0-earonly',
  buildLabel: 'AbuBank 0.279.0 — GOLDEN-SESSION 18/18 (real gpt-realtime, text instrument). FIXED+VERIFIED ON THE MODEL: (a) online FOLLOW-UP now RE-GROUNDS — get_current_info fires on "ויש גם גרסה קטנה יותר?" instead of deflecting her to a shop (was the sole 17/18 deviation, the degradation the owner saw on device 3x); (b) TIME queries route to get_current_info — the session injected the date but NOT the time, so the model fabricated it; "מה השעה עכשיו?" now grounds. REOPENED #1 "message ignored": Yaron & Yael ARE known contacts in family_data.json — a corrected probe (knowing them, not mocking not_found) shows a 7/7 (100%) comm-tool fire rate incl. both names, 0 false "I sent it" claims; the device miss was CONFIG DRIFT, not honest decline. Instruction ratchet held (<14000). Evidence: CODE + MOCK-tool + real-model text instrument — NOT physical-device-proven. Do NOT merge (production serves Aug 5).',
  buildDate:  '2026-08-16',
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
