# WAR ROOM · LIVE LOG

Newest first. Every finding logged as discovered. Severity: 🔴P0 🟠P1 🟡P2 ⚪P3.

## Run 1 — 2026-08-13 · branch `rc5/cognitive-architecture-and-acceptance`

### Baseline (verified this session)
- **typecheck**: GREEN (`tsc --noEmit`, exit 0).
- **full suite**: GREEN — **12662 passed**, 1 skipped, 2 todo, 475 files (`vitest run`, 24s).
- **build**: pending (running at time of writing).
- Test corpus size: **487 test/spec files** (199 AbuAI, 69 eval, 41 services, 36 AbuCalendar,
  24 AbuWhatsApp, 13 realtime, 13 evolution, 12 truth + 31 e2e Playwright specs).

### Reality assessment (the honest headline)
The brief presumes a mostly-unQA'd product. **That is not what this repo is.** It is an
unusually mature test estate. Concretely verified already-covered:
- **68×68 relationship inverse-consistency** (the brief's headline metamorphic A5 #1) is
  ALREADY implemented: `src/screens/AbuAI/familyReasonerProperties.test.ts` iterates every
  ordered pair `for a in people for b in people`, asserts inverse consistency, BFS-path
  existence, determinism, + 2000-query fuzz on random graphs. **Not a gap.**
- **Simulator** exists: `martitaSimulation.test.ts`, `eval/productionSimulatorScenarios.ts`,
  `eval/freeLanguageSimulation.test.ts`, `e2e/abuai-production-simulator.spec.ts`.
- **Invariants** are encoded in `src/services/textHarness/companionSuite.test.ts`
  (no-red-wine, no-announce, phone-not-aloud, distress, etc.).
- **App screens** have Playwright coverage (home-nav, contact-management, contact-photos,
  enlarged-text, family-record-screen, weather-smoke, service-worker, persistence*).
- **Acceptance board** (`docs/engineering-os/PRODUCTION_ACCEPTANCE_BOARD.md`) is already
  honest: RED rows are device-only (audibility, real STT on elderly voice, latency, barge-in,
  warmth) — which is exactly the brief's own `LEO-TESTS-ONLY` list.

### Genuinely empty / weak cells (candidates for real work) — see COVERAGE.md
1. 🟠 **Mutation testing (Phase M)** — NO kill-rate harness found anywhere. This is the
   brief's "most important phase" and it is genuinely absent. The suite's real defect-catching
   power is UNMEASURED.
2. 🟡 **Always-on invariant runner** — invariants exist but the companionSuite runner is
   **key-gated** (needs `OPENAI_API_KEY`, real model). There is no deterministic, always-on
   invariant assertion over the full scenario corpus in CI. Acceptance board noted P9-measure
   "blocked on API credits" — so invariants are NOT continuously enforced without credits.

### Findings

#### F1 🟠P1(gap)/P0(class) — mutation-harness survivor: family LABEL table unguarded [FIXED]
- **What:** Built the missing mutation harness (`scripts/mutation-harness.mjs`, Phase M). First run:
  5 real deterministic mutants + 1 negative control. **80% kill (4/5)** — one SURVIVED.
- **Survivor:** swapping the feminine/masculine grandchild term in `familyRelationEngine.ts`
  (`grandchild: ['נכדה','נכד']` → `['נכד','נכדה']`) **passed the entire 12662-test suite**
  (verified by running the FULL suite against the mutation, not just the owner file — it still
  reported 12662 passed). So no test anywhere protected it.
- **Mechanism (first divergence):** `labelFor()` returns `female ? pair[0] : pair[1]`, and
  `relationOf()` (the live family-answer path) emits that label to Martita. A swapped table makes
  a granddaughter be called "נכד" (grandson). `ofirGenderRegression` guards the gender DATA field
  and the Martita→grandchild (סבתא) direction, but NOT the grandchild-direction OUTPUT label. Live,
  reachable, gender-correctness → P0-class harm if it ever regresses; the missing-test is the P1.
- **Fix:** red-before-green regression `src/screens/AbuAI/familyRelationLabelGender.test.ts` — a
  generalized property test over the live graph (no hardcoded names): every female grandchild's
  real `relationOf` sentence must say נכדה, every male נכד-not-נכדה, + child בת/בן; non-empty
  guards prevent a vacuous pass. Proven RED under the mutation, GREEN on correct code.
- **Re-run:** mutation harness now **100% (5/5)**, control still behaves, tree restored clean.
- Not a live bug today (the table is currently correct) — it is a closed BLIND SPOT: the suite can
  now feel a gender-label regression it previously could not.

**Note:** a stray user message ("2") arrived mid-run; ambiguous, treated as no-op per protocol #2.
