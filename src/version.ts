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
  version:    '0.170.0-realtime-slice-harness-rc',
  buildLabel: 'AbuBank — REALTIME_SLICE_HARNESS (ADR-0001 §18). Wires the deterministic Realtime authority stack (control plane = STATE, tool-dispatch→kernel = TRUTH, streaming truth-monitor = SPEECH-GUARD) into a headless SessionOrchestrator with an injectable, mic-free event seam, projecting ONE canonical ActiveActionViewModel rendered by ActiveActionCard. A self-contained harness behind ?voice=realtime2 (OFF by default; the certified voice path is untouched) lets an operator inject the exact device-failure journey — WhatsApp card → "לא, תתקשרי אליו" atomic REPLACE to Call → complaint (no mutation) → interruption → fallback — with NO mic, so the §18 falsifier is provable by clicking in a deployed Preview. Kernel modes: PRODUCTION (the single buildCommunicationAction authority — slice and typed path cannot fork into two truth owners) or SIMULATED-READY (§19). No completion status is representable; a fabricated "שלחתי/התקשרתי" is blocked before voicing; no phone number enters the control plane or a tool arg; recipient/revision/generation carried on every receipt (stale + cross-generation results rejected). Evidence: CODE + TEST (54 tests: controlPlane 16 · realtimeTools 9 · truthMonitor 6 · sessionOrchestrator 9 · slice flag 14; typecheck 0; build green). BROWSER/PREVIEW = the deployed §18 click-through; DEVICE (mic naturalness/audibility) remains physical-only per §20 — not claimed. Builds on 0.169.0.',
  buildDate:  '2026-08-04',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
