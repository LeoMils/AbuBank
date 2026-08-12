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
  version:    '0.214.0-transcription-prompt-cap',
  buildLabel: 'AbuBank 0.214.0 — the REAL string_above_max_length field, found by asking the provider. 0.213.0 capped the wrong field: the device still connected (gpt-realtime-2.1) and died ~500ms later. Posting the exact session.update to the real /v1/realtime/client_secrets endpoint named the field precisely — param: session.audio.input.transcription.prompt, message: "string too long. Expected a string with maximum length 1024, but got a string with length 1034". So the over-limit field was the Hebrew TRANSCRIPTION BIAS PROMPT (it enumerates every family name + alias and grew from under-cap to 1034 with the 68-person update), NOT instructions (9,656 chars were accepted fine — isolation proved removing the transcription prompt returned HTTP 200). Fix: buildTranscriptionPrompt is now bounded to a safe budget under the 1024 provider cap — it keeps the closest family (PRONUNCIATION_GROUPS is ordered closest-first) plus ALL request phrasings and drops the long tail; it is a weak STT bias side-channel, so a bounded subset is correct. Now 1000 chars. A whole-payload build-time guard (assertSessionPayloadWithinLimits) validates EVERY provider-capped field — instructions (self-imposed 10k) AND transcription.prompt (documented 1024) — at module load and inside buildSessionUpdate on the exact sent values, failing the build with the field, size and cap; a harness assertion covers the shared payload. The flight recorder now records the session.update size on the connect line, so the next trace shows the number directly. Verified against the REAL provider: the full payload the device sends went 400 → 200 (a valid realtime.session minted). Evidence: real-API 200 (the exact config now validates) + CODE tests + full suite + build. Not yet a full physical WebRTC session — needs a device reconnect on the deployed build.',
  buildDate:  '2026-08-12',
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
