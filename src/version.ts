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
  version:    '0.272.0-earonly',
  buildLabel: 'AbuBank 0.272.0 — TWO-RESPONSE preamble path, behind a device-gated flag (overnight item 4). The client commit-window (preambleGate, 400ms) CANNOT catch the owner-measured ~4s preamble — the tool call arrives long after the window releases the audio. preambleTwoResponse.ts is the pure, tested decision core for the fix the owner recommended: the tool-selecting response is TEXT-ONLY (a spoken "רגע, אני בודקת…" becomes structurally impossible), and the grounded answer is a second AUDIO response after the tool result; a plain answer pays one extra round-trip. Ships OFF behind LIVE_PREAMBLE_TWO_RESPONSE (VITE_LIVE_PREAMBLE_TWO_RESPONSE=1), registered in the deviceGatedFlags ledger so it cannot be silently dropped, promoted only after AUDIO_CHECK #5 on device. The Realtime session wiring (per-response output_modalities + client-driven turns) is the device-validated remainder — deliberately NOT wired into the hot voice path while the account has no credit to verify it. Prior: LOUD-NOT-SILENT hardening + credit diagnosis (v0.271). Do NOT merge (production serves Aug 5).',
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
