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
  version:    '0.200.0-abuela-presence-m5s1',
  buildLabel: 'AbuBank 0.200.0 — ABUELA_M5_STEP1 (presence): Abu now has a living face on the Abu AI screen. AbuCharacterA is variant A (Warm Gold) rebuilt as an SVG split into named layer groups per CHARACTER-ASSET-SPEC.md (hair, base, eyes, eyelids, three mouth visemes, hair-front, rim) so a commissioned illustration swaps in later WITHOUT touching animation code. AbuPresence drives it: the mouth cross-fades closed→mid→open from the REAL output-audio RMS amplitude (services/outputAmplitude, AnalyserNode), with natural irregular blinking, CSS breathing, and a state aura for listening / thinking / speaking / waiting. Graceful degrade: no analyser ⇒ a gentle mouth loop so she never freezes mid-sentence. Frame budget: one rAF for the mouth while speaking, GPU-composited CSS for breathe/aura, a lightweight blink timer. Evidence: CODE + AUTOMATED TEST (11 assertions: amplitude opens the mouth, mid cross-fade, resting-closed when silent, four states + auras, the named-layer contract). On-device frame rate and whether she reads as warm are PHYSICAL_DEVICE / HUMAN-EYE — NOT claimed.',
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
