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
  version:    '0.98.0-math-calculator',
  buildLabel: 'AbuBank — MATH_CALCULATOR (Intelligence Parity Cycle 19, text-only via the real ExecutiveCognitiveController): a far wider adversarial probe (all of life) surfaced that everyday arithmetic — כמה זה 15 כפול 4, 200 חלקי 8, 20 אחוז מ-200, 15 אחוז טיפ על 240 שקל — fell to the LLM, which is unreliable at math. Added a deterministic mathReasoner (multiply/divide/add/subtract via Hebrew + Rioplatense operator WORDS and the true × ÷ symbols; percent-of; percent-tip with total; He + Es output) + a new math intent routed before online. isMathQuery only matches a real expression, so a price question (כמה עולה חלב) still routes online, and ASCII + - * / are excluded so times/dates/ratios (3-5, ב-3) are never mis-read as math. 15 כפול 4 → זה יוצא 60; 20 אחוז מ-200 → 40; 15 אחוז טיפ על 240 שקל → טיפ 36, בסך הכל 276. Evidence: mathReasoner.test.ts 8/8 green (CODE); math + calendar + online regression suites 333 green; full suite green. NOTE: unit conversions (km/kg/°C) + currency FX (live rate) are NOT yet deterministic — next cycles / online. Gap map: docs/INTELLIGENCE_GAP_MAP.md. Voice/Realtime deferred. Builds on 0.97.0.',
  buildDate:  '2026-07-15',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
