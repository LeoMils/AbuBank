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
  version:    '0.127.0-normal-speech-pace',
  buildLabel: 'AbuBank — NORMAL_SPEECH_PACE (Cycle 47 — latency pack: un-slow the voice by default). Standing law: the benchmark is the latest ChatGPT at NORMAL human speech pace, never slowed by default. The applied TTS speed for BOTH the primary OpenAI path (voice.ts speed: getVoiceSpeed) and Web Speech (u.rate) flows through getEffectiveRate → getVoiceProfile(lang).rate — which defaulted to 0.95 (He) / 0.97 (Es), i.e. slowed ~5%, and the Settings scale maxed at 0.95 (even fast was below normal). FIX: HE_VOICE.rate and ES_VOICE.rate → 1.0 (normal), and the Settings speed scale re-centered on 1.0 (איטי 0.9 / רגיל 1.0 / מהיר 1.1) with the default 1.0; a user who wants slower can still pick it (override honored + clamped 0.8–1.15). RED-first: the old voiceConfig test ENCODED the slowed default (rate <= 1.0, > 0.88) — rewritten to assert the standing law (default === 1.0), red before the fix. Realtime path paces itself (model-voiced), unchanged. Latency table recorded (docs/eval/LATENCY_TABLE.md): deterministic 0.31–0.68s < 1s (PREVIEW-measured), LLM ~4s, online 4.8–6.8s. Evidence: CODE — voiceConfig 6/6, full suite + typecheck + build. Physical audio pace is DEVICE evidence (not claimed here). Builds on 0.126.0.',
  buildDate:  '2026-07-18',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
