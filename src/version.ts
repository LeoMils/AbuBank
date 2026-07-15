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
  version:    '0.101.0-unit-conversions',
  buildLabel: 'AbuBank — UNIT_CONVERSIONS (Intelligence Parity Cycle 22, text-only via the real ExecutiveCognitiveController): wide-probe gap — everyday unit conversions (3 קילומטר במטרים, חצי קילו בגרם, 30 מעלות צלזיוס בפרנהייט) fell to the LLM. Extended the deterministic mathReasoner with convertUnits: length (km/m/cm), mass (kg/g), volume (l/ml) via fixed factors + same-dimension check, temperature C↔F via the real formula, and Hebrew word quantities (חצי=0.5, רבע=0.25, שלושת רבעי=0.75). Fixed a substring collision where קילו inside קילומטר matched the kg unit (kg now uses קילו(?!מטר)), so 3 קילומטר במטרים → 3000 (not a km→kg dimension error). A price (כמה עולה חלב) or mismatched units returns null and still routes online. Evidence: unitConversion.test.ts 7/7 + mathReasoner.test.ts 8/8 green (CODE); calendar+online regression suites 309 green; full suite green. NOTE: currency FX (live rate) is still online/PREVIEW-class, not deterministic. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.100.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
