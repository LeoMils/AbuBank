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
  version:    '0.87.0-clinic-location-capture',
  buildLabel: 'AbuBank — CLINIC_LOCATION_CAPTURE (Intelligence Parity Cycle 8, text-only via the real ExecutiveCognitiveController): closes gap C5. תקבעי פגישה עם הרופא מחר בבוקר בקופת חולים בכפר סבא בתשע captured the location as only כפר סבא — קופת חולים (the HMO clinic, the real venue) was dropped because it was not in the venue head-word list, so the extractor fell through to the bare-city match. Added קופת חולים (+ קופ"ח/קופ״ח) to VENUE_HEAD, so the venue matcher captures קופת חולים בכפר סבא and stops before the time (בתשע never leaks in). Evidence: clinicLocationCapture.test.ts 2/2 green (extractor + real controller); extractor + calendar regression suites 125 green; full suite green. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.86.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
