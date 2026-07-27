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
  version:    '0.153.1-abuai-whatsapp-intent',
  buildLabel: 'AbuBank — ABUAI_WHATSAPP_INTENT (session 15). Fixes the reported defect: in Abu AI a "תכתבי/שלחי/תתקשרי ל<מישהו>" request whose message body mentions a date/time was hijacked by the calendar (the wrong "מחר אין כלום ביומן") and the recipient name was dropped. Added a WhatsApp/call intent to the cognitive controller (runCognitiveTurn + runtimeFullTurn) with precedence OVER calendar, prefix-safe name extraction (למור→מור), and inline composition: Abu AI now drafts the message with the shared compose capability and points to WhatsApp — never a calendar answer and no hallucinated calendar claim. Typed and voice share one detector (detectWhatsAppTurn) and one reply builder (buildWhatsAppReply). Evidence: CODE — whatsappTurnRouting 10/10 plus the full suite (only pre-existing date-flaky calendar tests fail); BROWSER — Playwright abuai-whatsapp-intent 2/2 on the built app. Broader ChatGPT-Live parity remains the standing V4 program. Builds on 0.153.0.',
  buildDate:  '2026-07-27',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
