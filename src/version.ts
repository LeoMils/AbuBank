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
  version:    '0.153.13-import-autonav-rc',
  buildLabel: 'AbuBank — IMPORT_AUTONAV_RC (session 27). Finishes AbuAI Communication for restricted production. CALL is now first-class: a generic call CommunicationAction (mode=call, channel=phone) that the phone adapter turns into a sanitized tel: handoff resolved ONLY in the adapter (never in the controller, Action, or telemetry); AbuAI says "פותחת שיחה למור" and never dials. WhatsApp is the clear path: ONE primary action, WhatsApp is the review surface (no forced draft), the body is never read aloud; an explicit "תראי לי" shows an editable draft that reaches the adapter byte-for-byte. Meaning over transcript: a deterministic semantic pass resolves self-corrections (בארבע סליחה בחמש to five) and removes retracted content (אל תזכירי את X), while uncertainty/conditions/promises are preserved; the verifier keeps numbers/times/urls across styles. Default style is Martita authentic voice from the curated corpus; funny/abu keep facts. Missing telephone vs missing WhatsApp are handled separately. Evidence: CODE + TEST — production gates 21/21, targeted 89/89, full suite 0 new regressions vs the clean tree; BROWSER — Playwright 8/8. Fixes the device regression where a WhatsApp message whose BODY mentioned a meeting (e.g. תכתבי למור שיש לי פגישה מחר) was routed to Calendar: detection now anchors on the LEADING write/send/call verb, not calendar words in the body. Product Truth now sets BRAIN_PIPELINE_USED/EXECUTIVE_CONTROLLER_USED on the TEXT and pipeline-voice paths too (previously only the realtime path), so the flag reflects reality when OpenAI Realtime WebRTC is unavailable and voice falls back to Web Speech + pipeline TTS. The communication brain (routing/recipient/semantic/compose/verify) runs on every turn regardless of Realtime; the deployed gpt-4o chat proxy is verified alive. Evidence adds routing regression tests + BROWSER rc-verify 2/2. DEVICE NOT PROVEN. Builds on 0.153.4.',
  buildDate:  '2026-07-27',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
