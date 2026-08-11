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
  version:    '0.201.0-abuela-presence-screen-m5s2',
  buildLabel: 'AbuBank 0.201.0 — ABUELA_M5_STEP2 (Abu AI screen): the live-voice screen rebuilt in the Night Garden system. AbuPresence is the centre of the screen — her mouth follows her REAL output-audio amplitude (liveSession.onRemoteStream → useOutputAmplitude, one rAF), and the four states map from the session: connecting / user-just-finished → thinking, listening, speaking, idle → waiting. PAGE_BG + theme tokens throughout (Night Garden dark + Bright Day), an Abu-AI logo header, a plain-Hebrew state label (never colour-only), the transcript, the calendar / comm action-card receipts, the flight-recorder trace export, and the build fingerprint are all preserved. liveSession gains two observation-only callbacks (onRemoteStream, onThinking) that change no VAD / turn / audio behaviour. Evidence: CODE + AUTOMATED TEST (session→presence mapping, the live entry-point cutover + build fingerprint, presence render, the liveSession suite — all green). Whether she reads as warm and the on-device frame rate are PHYSICAL_DEVICE / HUMAN-EYE — NOT claimed.',
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
