# Rule: The Golden Session & the handover report (permanent)

**Why this exists:** the repo had 13,000 tests on FRAGMENTS and, for weeks, not one test of a WHOLE
conversation — so green gates sat beside a product that hung after one question, and nobody saw it
until the owner opened his phone. The Golden Session is the fix. (Overnight war room, v0.278.)

## The Golden Session is the top-line metric
- **Canonical spec:** `src/services/goldenSession.ts` — one scripted end-to-end conversation
  (greeting → goodbye) covering EVERY capability, each turn declaring in advance: which tool must fire
  (or must not), that something IS spoken, the language, and what must never appear (source names,
  preamble, method narration, capability menus, foreign words).
- **Every build (deterministic):** `src/services/goldenSession.test.ts` locks the contract detectors
  and emits `scripts/golden/golden-session-spec.json`. A contract regression BLOCKS the build.
- **On demand (real model):** `node scripts/golden/golden-session.mjs` drives the real gpt-realtime
  through the arc and writes `docs/eval/GOLDEN_SESSION_RESULT.json`. This answers the ONLY number that
  matters: **does a full session complete with every turn correct and no dead ends?**
- The instrument tests the CURRENT instructions: `src/services/sessionSnapshot.gen.test.ts`
  regenerates `docs/eval/SESSION_CONFIG_SNAPSHOT.json` from `buildSessionUpdate()` every build. Never
  hand-edit that snapshot (it silently drifted to 2.5× the real size once — never again).
- Any anomaly a reader finds in a transcript that no check caught becomes a NEW assertion in the spec
  immediately. Fix the truth; never weaken the spec to force a pass. If a strict turn mis-grades
  genuinely-correct behavior, correct the CONTRACT (e.g. `allowTools`) and say why.

## The handover report changed permanently
Do NOT report "gates green." Report:
1. **Golden session: PASS or FAIL, and exactly which turns deviated.**
2. **How many full sessions were run and how many transcripts were read in full** (not scored summaries).
3. **Every anomaly found**, even ones no check covers.
4. **What was fixed and re-verified end to end** (evidence class per the ladder).
Green unit tests are `CODE` evidence only. They are NOT accepted as proof a session works — real
device/session evidence overrides them.
