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
  version:    '0.153.0-whatsapp-voice-compose',
  buildLabel: 'AbuBank — WHATSAPP_VOICE_COMPOSE (session 14). Abu WhatsApp voice/typed "כתבי הודעה בקול": Abu AI understands who + what + style, composes in her own voice (server gpt-4o → free tiers → deterministic local fallback), verifies facts, shows an EDITABLE draft, supports style switch and spoken/typed follow-up corrections, resolves the recipient by Hebrew name with fuzzy/STT tolerance and an ambiguity prompt (never a silent guess), and opens the WhatsApp chat of the chosen contact PRE-FILLED — manual send only, never auto-send. Reusable capability boundaries live in whatsappCompose.ts (intent/plan/style/compose/verify/follow-up) plus the channel adapter and privacy-safe telemetry. Fixed a real crash found in the browser smoke: an unhandled clipboard writeText rejection tripped the global error screen. Evidence: CODE — compose/resolve/parity unit suites green, typecheck + full suite (only pre-existing date-flaky calendar tests fail); BROWSER — Playwright smoke 5/5 (voice-injected and typed parity, ambiguity, no-phone, provider-failure fallback, exact wa.me prefill, iPhone-SE responsive). NOT device-proven: real microphone audio and the real WhatsApp handoff need a physical phone. Builds on 0.152.0.',
  buildDate:  '2026-07-27',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
