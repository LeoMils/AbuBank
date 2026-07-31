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
  version:    '0.153.2-communication-capability',
  buildLabel: 'AbuBank — COMMUNICATION_CAPABILITY (session 16). AbuAI now returns a generic, channel-agnostic CommunicationAction when the final intent is "communicate": the cognitive controller (runFullTurn) composes and VERIFIES the message, and the chat renders a generic card — the reviewed, editable draft plus ONE primary action supplied by the channel adapter (WhatsApp is the first: "פתחי בוואטסאפ"). Pressing it opens the correct conversation with the EXACT reviewed (even edited) text prefilled — never modified, never auto-sent. New abstraction: communication/{types,registry,capability}, an AbuWhatsApp channel adapter, and a generic CommunicationActionCard rendered from ChatMessage.action (mirrors the error to ErrorCard pattern). SMS/Email/Telegram can plug in as adapters with NO controller change. The Action is pure data — no phone number leaks into it. An explicit calendar-create wins over the communication precedence so a "…ותכתבי להביא…" note is not mis-sent. Evidence: CODE — communication/capability 7/7, whatsappTurnRouting 11/11, full suite (only pre-existing date-flaky calendar tests fail, identical to clean tree); BROWSER — Playwright 8/8 including edit-preserved exact wa.me prefill and no auto-send. Builds on 0.153.1.',
  buildDate:  '2026-07-27',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
