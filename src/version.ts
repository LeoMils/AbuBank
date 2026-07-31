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
  version:    '0.153.4-communication-production-rc',
  buildLabel: 'AbuBank — COMMUNICATION_PRODUCTION_RC (session 18). Finishes AbuAI Communication for restricted production. CALL is now first-class: a generic call CommunicationAction (mode=call, channel=phone) that the phone adapter turns into a sanitized tel: handoff resolved ONLY in the adapter (never in the controller, Action, or telemetry); AbuAI says "פותחת שיחה למור" and never dials. WhatsApp is the clear path: ONE primary action, WhatsApp is the review surface (no forced draft), the body is never read aloud; an explicit "תראי לי" shows an editable draft that reaches the adapter byte-for-byte. Meaning over transcript: a deterministic semantic pass resolves self-corrections (בארבע סליחה בחמש to five) and removes retracted content (אל תזכירי את X), while uncertainty/conditions/promises are preserved; the verifier keeps numbers/times/urls across styles. Default style is Martita authentic voice from the curated corpus; funny/abu keep facts. Missing telephone vs missing WhatsApp are handled separately. Evidence: CODE + TEST — production gates 21/21, targeted 89/89, full suite 0 new regressions vs the clean tree; BROWSER — Playwright 8/8. DEVICE NOT PROVEN (real tel:/WhatsApp handoff and no-auto on a physical iPhone). Builds on 0.153.3.',
  buildDate:  '2026-07-27',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
