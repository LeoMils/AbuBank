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
  version:    '0.257.0-audio-trackA',
  buildLabel: 'AbuBank 0.257.0 — TRACK A audio (built now, flag-gated, owner-audible). The audio defects were deferred as "device-only" — that confused CANNOT-VERIFY with CANNOT-BUILD. Built: (1) far-field noise reduction on audio.input (VITE_LIVE_AUDIO_TUNE_V2) — the documented fix for a speakerphone hearing its own loudspeaker (self-interruption + a second overlapping voice); (2) client barge-in truncate (VITE_LIVE_BARGE_IN_TRUNCATE) — on a real barge-in, cancel the in-flight response and conversation.item.truncate the assistant item to the played position, so client+server agree and the next turn does not collide (the likely "only first sentence audible" cause). interrupt_response stays FALSE so the SERVER never truncates on echo — the correct COMBINED behaviour behind new flags, not a blind flip. Both env-overridable + OFF by default (payload byte-identical when off); enable TOGETHER (NR tames echo before the truncate is safe). CODE proven (liveAudioTrackA.test 8 + default-off safety in liveSession.test); audibility is the owner ear — docs/eval/AUDIO_CHECK.md (5 steps, A/B). Prior: scope inventory (v0.256).',
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
