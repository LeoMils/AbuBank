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
  version:    '0.149.0-verification-regime',
  buildLabel: 'AbuBank — VERIFICATION_REGIME (INTAKE REBUILD, session 10 · P1-P8 complete). Closes the intake-rebuild mandate on the CODE side. (1) FULL corpus clean: 387 files / 11546 tests pass / 0 regressions (marathon + mirrors + morphology + garble + all guards). (2) Internal FREE-LANGUAGE SIMULATION (src/eval/freeLanguageSimulation.test.ts): 300+ generated free-form utterances crossing the morphology table × garble × every family member × the intake paths (who-is / create-title / correction), asserting the rebuild invariants at scale — never throws, a resolved person is ALWAYS a real family member (never fabricated/wrong), a garbled term resolves right OR to nobody, a create with a relation companion stores the RESOLVED name, no output is a capability-denial. (3) A 10-line plain-Hebrew Leo test card (docs/engineering-os/LEO_FREE_LANGUAGE_TEST_CARD.md). HONEST LIMITS: the mandate 200-session run through the DEPLOYED app + on-device voice/latency is PREVIEW/PHYSICAL and is NOT done here; the Vercel Preview auto-builds on push but promotion is human-gated and I could not fetch its URL from this environment. Evidence: CODE + local simulation. NOT device-proven — only the Leo free-language round decides ready. Builds on 0.148.0.',
  buildDate:  '2026-07-20',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
