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
  version:    '0.273.0-earonly',
  buildLabel: 'AbuBank 0.273.0 — TWO-RESPONSE WIRED + measured on the real model (credit restored). Credit verified LIVE (200, not 429). Wired the two-response path into the LIVE LiveSession behind LIVE_PREAMBLE_TWO_RESPONSE: create_response:false + a client-driven TEXT-ONLY decision on speech_stopped (a preamble cannot be voiced), then a spoken answer (tool path speaks the grounded result; a plain turn gets an explicit audio response). Unit-tested (liveSession two-response block). MEASURED on a real gpt-realtime WS instrument with the shipping instructions+tools: the model emits NO spoken preamble before a tool call in EITHER text or audio mode — the tool-selecting response is function_call-only. So the owner-heard ~4s preamble does NOT reproduce on the instrument; it is a DEVICE/WebRTC-path phenomenon and two-response benefit is device-confirmable only. On the instrument the first words out are already the answer. Ships OFF (device-gated). Prior: two-response core (v0.272). Do NOT merge (production serves Aug 5).',
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
