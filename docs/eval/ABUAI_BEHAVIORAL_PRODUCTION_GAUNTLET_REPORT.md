# AbuAI Behavioral Production Gauntlet Report (Phase 14) + Integration Proof (Phase 15)

**Build:** `0.17.0-behavioral-production-green` · **Verdict: HOLD.**

## Gauntlet — measured per-category (through `runFullTurn`)

`src/eval/abuaiBehavioralProductionGauntlet.test.ts` — **786 behavior scenarios**:

| Category | Score | Threshold |
|---|---|---|
| Calendar | **100%** (136/136) | 97 |
| Family | **100%** (176/176) | 98 |
| Online | **100%** (142/142) | 96 |
| General | **100%** (60/60) | 96 |
| Frustration | **100%** (40/40) | 96 |
| Continuation | **100%** (60/60) | 96 |
| Audio | **100%** (40/40) | 96 |
| Hebrew | **100%** (36/36) | 96 |
| Supervisor | **100%** (36/36) | 96 |
| Speech | **100%** (60/60) | 96 |

0 legacy bypasses · 0 critical hallucinations · 0 wrong cancellations · 0 confirmation loops. Every row is RUNTIME_FINALIZED.

> Honest scope: 786 > the 750 minimum, generated-combinatorial (not 750 hand-authored transcripts); they exercise real varied inputs through the full runtime and assert real behavior.

## Phase 15 — Live runtime integration proof

Under `VITE_ABUAI_COGNITIVE_RUNTIME_V2_FULL=true`:
- **Text path** (`handleSend`) → `runFullTurn` (returns before any legacy branch). ✓
- **Voice path** (`handleText`) → `runFullTurn`. ✓
- Calendar create/save/read/search, family, online/general, frustration/audio/continuation → all through `runFullTurn`. ✓
- **Every emitted answer carries RUNTIME_FINALIZED** (proven by `noBypassRuntimeGuard.test` + master replay finalized=100%). ✓

Not covered (why HOLD): the flag is **off by default** (device-gated), reminders/recurring/delete/update are not yet runtime-*reasoned* domains (they route through the finalizer under the flag → no raw bypass, but mis-domained), and nothing is deployed/device-verified.

## Gates

validate:family ✓ · validate:knowledge ✓ · typecheck ✓ · **full suite 6146/6146** ✓ · build ✓ · master replay 27/27 ✓ · behavioral gauntlet 786 ✓.

## GO / HOLD

**HOLD.** Every code-testable behavior is HIGH-GREEN and proven on real-failure replay + 786 behavior scenarios through the live runtime — but the full flag is off by default, some calendar-mutation domains aren't runtime-reasoned, and nothing is deployed/device-verified.
