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
  version:    '0.280.0-earonly',
  buildLabel: 'AbuBank 0.280.0 — GOLDEN-SESSION 18/18; borderline turns spanish_back 5/5 + online_followup 5/5 stable on the real model. DEVICE-TEST FIXES (owner v0.279): (1) online answers ENRICHED — a film now gives plot + full cast + why-she-might-like-it (1→5 warm sentences) and get_current_info self-enriches its own query; the latent "mention the source" tool instruction was REMOVED (source-naming). (2) relationship chains COLLAPSED to one anchored phrase ("גלעד בעל הנכדה שלך ועדי נכד שלך"), never a hop chain. (3) ICE loss AUTO-RECONNECTS — transient "disconnected" gets a grace window, a real failure reuses the proven safe-config reconnect — no more dead error at 443s. FLAG VISIBILITY: /build-flags.json now reports every effective flag in the DEPLOYED build (the "9/9 preamble" was LIVE_PREAMBLE_TWO_RESPONSE shipping OFF); this preview ships it ON. Evidence: model-instrument + unit; ICE-reconnect + preamble are CODE/needs-device. Do NOT merge (production serves Aug 5).',
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
