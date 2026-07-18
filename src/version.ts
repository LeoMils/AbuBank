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
  version:    '0.128.0-voice-readiness',
  buildLabel: 'AbuBank — VOICE_READINESS (Cycle 48 — voice-readiness pack, code-level, no device claims). Three mechanisms, each RED-first, each wired (no dead code): (1) iOS mic constraints centralized to ONE source (services/audioConstraints MIC_GETUSERMEDIA: echoCancellation + noiseSuppression + autoGainControl) and applied at every primary capture site (recording, realtimeVoice, AbuCalendar, VoiceDebugPanel) — the constraints already existed but were duplicated 4x and could drift; a bare audio:true stays only as the iOS fallback. (2) Per-user speech profile (services/speechProfile) as the single source for spoken pace — NORMAL (1.0) by default per the standing law, changes ONLY by explicit user action; voice.ts getVoiceSpeed and the Settings speed control both go through it. (3) Cached instant warm openers (services/warmOpeners) — varied, warm, non-menu, He+Es time-of-day variants — wired into getVoiceGreeting behind a DEFAULT-OFF flag (abu-warm-openers) pending Leo blind listening, so zero behavior change until switched on. Also shipped the WEEKLY PARITY GUARD (src/eval/parityGuard.*: parity scorecard + marathon smoke + flight-recorder replay → dated PARITY_GUARD_LATEST.md; run PARITY_GUARD_WRITE=1 npx vitest run src/eval/parityGuard.test.ts) and refreshed docs/LEO_TYPED_TEST_SCRIPT.md to 31 numbered bilingual checks with exact expected answers from the preview E2E. Evidence: CODE — voiceReadiness 7/7, parityGuard 1/1 GREEN, full suite + typecheck + build. Physical audio is DEVICE evidence (not claimed). Builds on 0.127.0.',
  buildDate:  '2026-07-18',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
