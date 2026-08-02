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
  version:    '0.167.0-durability-laws-and-gate-suites-rc',
  buildLabel: 'AbuBank — DURABILITY_LAWS + GATE_SUITES (session 43). Continues Claude-owned automatable QA across the remaining gates. GATE 4/1: durabilityLaws.test.ts encodes executable laws D3/D4/D6/D7/D8/D9/D10 against the REAL contact-storage functions, each with an injected mutant proving the check catches the defect (seed-overwrites-phones, migration-strips-phones, stale-Board-snapshot). GATE 5/D11: durableCommitContract.test.ts proves with a delayed backend that a fire-and-forget write is NOT durable until flush() resolves — the automatable equivalent of a hard kill in the race window; and the FIX ships: Contact Management import/save now AWAITS durable.flush() before reporting success, so "saved" can never precede the IndexedDB commit (the blocking invariant). GATE 6: injectedVoiceParity.test.ts drives injected SpeechRecognition events through the REAL DictationController to a final transcript, then through runCognitiveTurn (the SAME controller typed input uses), proving interim/final, early-onend+restart (no loss/dup) and a mid-utterance correction all route IDENTICALLY to typing — typed/voice parity is proven, not asserted. GATE 7: action-reachability.spec.ts upgrades DOM-presence to elementFromPoint not-obscured + in-viewport + >=44px at 3 iPhone viewports and composer-focused, on the deployed origin. Red-team pass also caught and FIXED a self-inflicted privacy regression (persistenceTrace.test.ts used non-allow-listed phone tokens). Evidence: CODE + TEST (new gate suites 32/32) + PREVIEW (reachability 4/4, 2-engine persistence lab). DEVICE: only the iOS storage-partition confirmation remains. Builds on 0.166.0.',
  buildDate:  '2026-08-03',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
