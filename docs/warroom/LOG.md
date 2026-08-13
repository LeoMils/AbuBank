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

#### F2 🟡P1 — mutation-harness survivor: Israeli-ID PII mask unguarded [FIXED]
- **What:** Expanded the harness to 7 real mutants (added the online honesty gate + Israeli-ID
  redaction). Results: the **online honesty gate KILLED** — the canonical World-Cup incident
  (`api/abuai-online.ts` zero-source ⇒ `ONLINE_NO_RESULTS`) IS guarded by `onlineGroundingGate.test`.
- **Survivor:** disabling the Israeli-ID (9-digit) PII mask in `redaction.ts`
  (`cls:'israeli_id', mask:'[id]'`) passed the whole suite — NO test asserted ID masking, though
  `.claude/rules/privacy*.md` require IDs never be stored.
- **Fix:** two red-before-green assertions in `redaction.test.ts` — a 9-digit ID → `[id]` (and the
  raw digits gone), plus a long digit-run → `[number]`. Green on correct code; KILLS the mutation.
- **Re-run:** harness **100% (7/7)**, control behaves. P0/P1 kill rate 7/7.

### ▶ RESUME POINT (safe to /clear) — pushed at 90a1013, build 0.226.0
State: baseline GREEN (typecheck · 12,668 tests · build). Three commits pushed to
`rc5/cognitive-architecture-and-acceptance`. Working tree's remaining `M` files are PRE-EXISTING
(dirty at session start — NOT this run's; do not touch). Nothing of this run is uncommitted.

**Next highest-ROI (in order), zero re-derivation needed — see COVERAGE.md empty cells + OPEN.md:**
1. **Extend the mutation manifest** (`scripts/mutation-harness.mjs`, data-driven) into the empty
   layers: calendar dedup/confirm→two-events (find anchor in `calendarCreate.ts`), never-invent
   family guard, feminine self-reference. Each survivor → red-before-green test, then re-run.
   App/Platform mutants (40px target, RTL, SW-update, idle-timeout) need a Playwright-level mutation
   mechanism — a SEPARATE harness; note that honestly, don't force them into the unit harness.
2. **O2 · always-on deterministic invariants** — make companionSuite's invariant list assertable
   without a key over the deterministic corpus.
3. **O3/O4/O5** — rollback proof, deploy dry-run, monitoring/heartbeat design.

#### F3 — mutation harness extended to Layer B (App): 10/10, no new survivor
- Added 3 app-layer mutants with deterministic vitest owners: **touch-target 56→40** and
  **body-text 16→12** (owner `design/seniorFirst.test.ts`; MIN_TOUCH feeds Card + PrimaryButton),
  and **calendar-save drops the title field** (owner `calendarPersistence.test.ts`, B4 roundtrip
  `toEqual`). ALL THREE KILLED — the senior-UX sizing floor and calendar data-integrity are guarded.
- Honest outcome: no new bug this round; these app guards are solid. The brief's other app mutants
  (RTL break, back-nav, name overflow) are Playwright/DOM-render level and need a SEPARATE harness —
  flagged in COVERAGE/OPEN, NOT forced into this unit harness as weak proxies.

#### F4 — mutation harness extended to Layer D (Journeys) + C (Platform): 13/13
- **Journey mutants (both KILLED):** (1) card→WhatsApp handoff drops the composed message from the
  wa.me link (owner `liveActionCards.test.ts`); (2) confirm→two-events — exactly-once dedup by call
  id disabled in `calendarDraftController.ts` (owner `calendarRuntimeIntegration.test.ts`, the
  "same call in two shapes → one draft" test). Both handoffs are guarded.
- **Platform mutant (KILLED):** SW/stale-bundle detection inverted in `versionSync.detectStaleBuild`
  — a new deployed version would NOT be flagged stale (device serves old code forever). Owner
  `versionSync.test.ts`.
- **NOT seeded — real gap found:** the idle-timeout **session lifecycle** (12s stop-streaming / 25s
  ask-once / 45s warm-goodbye / resume-with-thread / 20-min outward nudge) has **no deterministic
  module or constants** to mutate — `IDLE_RUNTIME` is a cognitive-runtime state, `responseLifecycle`
  is audio-state only. Tracked as **O-LIFECYCLE** (OPEN.md) — a feature gap, not just a test gap.

#### F5 — Playwright DOM mutation harness built + proven (item #3): 2/2 KILLED (BROWSER)
- New `scripts/mutation-harness-e2e.mjs` — mirrors the unit harness but runs Playwright specs
  against a live dev server (:5175), for LAYOUT facts jsdom cannot prove. Probes the server first
  and refuses to run if it is down (a down server must never read as "survived"). Restores every
  mutated file in `finally`; git is the safety net (used once when a 2-min FOREGROUND bash limit
  SIGTERM-killed a run mid-mutant — lesson: run this harness BACKGROUNDED).
- Mutants (both KILLED, BROWSER evidence): (1) **RTL** — `index.html` dir=rtl→ltr, owner the new
  red-before-green `e2e/rtl-direction.spec.ts` (asserts document dir + computed body direction =
  rtl); PROVEN green-on-correct (8.4s) and red-under-mutation. (2) **touch-target** — MIN_TOUCH
  56→30 falls below the enlarged-text 40px rendered-height floor, owner `e2e/enlarged-text.spec.ts`.
- Closes the "App RTL/overflow needs Playwright" gap the unit harness honestly could not cover.
  Back-nav + name-overflow still uncovered (no owning spec yet) — tracked in COVERAGE/OPEN.

### Run 1 mutation summary
**10 deterministic mutants + 1 negative control → 100% kill (10/10).** Started 80% → 100% after
closing TWO real blind spots (family label gender F1, Israeli-ID redaction F2); then extended into
Layer B (F3, 3 app mutants, all killed). Control never mis-fired. Every mutant restores its file in
`finally`; full suite re-confirmed green after each fix. Layers covered: A/Brain, A/Online,
A+B/Privacy, B/App-SeniorUX, B/App-DataIntegrity. NOT yet: App-RTL/nav/overflow (Playwright),
Platform (SW/idle), Journeys (card→WhatsApp/confirm→two-events).
