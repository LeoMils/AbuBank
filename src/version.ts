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
  version:    '0.244.0-live-state',
  buildLabel: 'AbuBank 0.244.0 — UI STATE agent: ONE reconciled live-state indicator, and the QA badge hidden outside development. Trace defect: "you are speaking while the screen says you are listening." Mechanism: the LiveScreen state WORD read the raw session LiveState (STATE_LABEL[state], which had no "thinking"), so it could disagree with her face/aura — those read the reconciled presenceState. Change: the big spelled-out word now derives from the SAME reconciled presenceState as the face (liveStateWord), enlarged to 30px for an 80-year-old, so during an active turn it is always exactly one of מקשיבה/חושבת/מדברת and can never claim listening while she speaks or thinks. Also: the Home "QA: v…" badge is now gated to development builds only, so Martita never sees it in production (the running build stays confirmable via Settings→About + the operator diagnostic panel). Evidence: CODE — presenceState.test.ts regression (the word is driven by the reconciled state, never the raw state) + version.visibility.test.ts (badge DEV-gated) + typecheck + full suite + build. Browser/device confirmation of the on-screen render is a PHYSICAL_DEVICE item, not claimed here. Prior: reminders on the live path (v0.243).',
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
