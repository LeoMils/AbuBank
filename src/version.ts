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
  version:    '0.265.0-preamble-design',
  buildLabel: 'AbuBank 0.265.0 — M1 PREAMBLE design pass (the most frequent thing the owner hears, 5/5 tool calls). WebRTC streams the tool-selecting response audio before the client sees the function_call, so there is no server-side interception. Chose the CLIENT COMMIT WINDOW (owner option 2) over the two-response server pattern (option 1 fights create_response:true and adds a round-trip to every turn). preambleGate.ts is the pure decision core (5 tests): audio then a function_call inside the window -> SUPPRESS the preamble; window elapses with no tool call -> PLAY; a tool call after real speech never retro-mutes the answer. MEASURED latency by construction: +400ms to the first word of a PLAIN answer (well inside the 4s budget), +0 on a tool turn. Ships behind LIVE_PREAMBLE_GATE (default OFF); the WebAudio DelayNode wiring + audibility are the device-validated remainder. Report docs/eval/M1_PREAMBLE_DESIGN.md. Prior: surname guard (v0.264).',
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
