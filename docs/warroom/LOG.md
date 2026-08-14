# WAR ROOM · LIVE LOG

Newest first. Every finding logged as discovered. Severity: 🔴P0 🟠P1 🟡P2 ⚪P3.

## Run 2 (LAST BUILD) — 2026-08-14 · branch `rc5/cognitive-architecture-and-acceptance`

### Baseline (verified this run)
- typecheck GREEN; full suite **12723 passed** / 1 skip / 2 todo (481 files) BEFORE changes.
- Working tree carried a parallel workstream's uncommitted churn (abuai-live-*, chatgpt-live,
  regenerated knowledge/memory, a deleted `familyContactsStorage.test.ts` — covered by sibling
  `familyContactsStorageGuards`/`familyContactsDurability`). NOT folded into my commits.

### Item 1 · ONE VOICE ENGINE — DONE (v0.236.0) · commit pending
- **Decision (D7):** the AbuCalendar screen ran a SECOND speech engine — `handleVoiceRecord()` →
  `getUserMedia` → `MediaRecorder` → `transcribeCalendarAudio` (Groq Whisper) → `createSilenceDetector`
  → `processVoiceTranscript` action-switch — feeding appointment-create, reminder-create AND
  schedule-query. **Mechanism proof it is redundant:** Abu AI's `cognitiveRuntime.ts:1082` creates via
  `createAppointmentSafe`/`addAppointment` from `../AbuCalendar/service` (verified with
  `loadAppointments`), modifies via `calendarMutationReasoner` (same store), and handles reminders
  (`isReminderIntent`/`pendingReminder`). So Abu AI already owns all three, in the same session + store.
- **What was REMOVED (from `index.tsx`):** the capture body, `mr.onstop` processing, the
  `processVoiceTranscript` switch, the voice reminder-confirm branch, the inline VoiceAddFlow/VoiceCard
  render, the dev capture panels (MicSelfTest/QaRecorderPanel/GuidedMicQaPanel), and all now-dead
  state/refs/imports. **What was ROUTED:** both product mic CTAs (DayDetailSheet footer + main add-bar)
  now `setScreen(Screen.AbuAI)` — the ONE engine — keeping the "דברי אליי" affordance + `main-mic-btn`
  test id. **UNTOUCHED:** typed `ManualModal`, `ReminderBoard`/`ReminderDueEngine` display, grid.
- **Guard + mutant (teeth proven):** new `singleVoiceEntry.test.ts` (no getUserMedia/MediaRecorder/
  silence/transcribe in the calendar path; mic routes to `Screen.AbuAI`). Mutation-harness mutant
  `second-voice-engine-reintroduced` [P0] reintroduces a getUserMedia reference → **KILLED**. Harness
  now **16/16 (100%)**, control OK.
- **Tests migrated (source-contract → new truth), behavior kept green:** `micCapture`, `voiceTrace`,
  `voiceRecordGuard`, `guidedQa`, `voiceCardSlots`, `voiceUxContract`, `timezoneLocal`,
  `calendarAddSurface`, `createPipelineIntegration`, `calendarTranscribe`, `voiceTranscriptionFailureCopy`,
  and the index-wiring blocks of the 3 NAMED tests. The named BEHAVIOR contracts stay green untouched:
  `voiceAutoCreate` (parser), `voicePersistence` (100% pure, untouched), `voiceConfirmationP02` (VoiceCard
  component). Also migrated the cross-cutting `services/voiceReadiness.test.ts` capture-site list.
- **Gates:** typecheck 0 · full suite **12679 passed** / 1 skip / 2 todo (482 files) · build 0 · version
  contract 22/22 · mutation 16/16.
- **Adversarial pass finding — 🟡 O-VOICE-ORPHANS:** removing the wiring leaves ~7 now-unreferenced
  modules (VoiceAddFlow, voiceAutoCreate, VoiceCard, calendarTranscribe, VoiceDebugPanel,
  voiceRecordGuard, calendarTranscriptCorrection; voiceTrace/ReminderConfirmCard only reached
  transitively). They TREE-SHAKE out of the shipped bundle (build clean), so this is source-only dead
  code. D7 retained them as library (deleting them + their ~15 unit-test files is a separate, larger,
  riskier refactor — deferred, tracked in OPEN.md). Honest status: not deleted.
- **Device note (Leo):** tapping the calendar mic now jumps to the Abu AI chat rather than an inline
  calendar card. Capability-equivalent (Abu creates/reads/edits on the same store) but it IS a screen
  change to feel on device — added to LEO-TESTS-ONLY.

### Item 2 · COST — the first real number — DONE (v0.237.0) · commit pending
- **Measured (CODE model, real OpenAI Realtime rates; see `docs/warroom/COST_REPORT.md`):** a
  representative 20-min companion session costs **~$2.26/₪8.34 BEFORE** the O-LIFECYCLE idle-stop
  (mic streams the whole call) vs **~$1.45/₪5.37 AFTER** → **$0.80/₪2.97 = 35.7% saving**. The cut is
  ONLY idle mic-input minutes; Abu audio-output + text are byte-identical (tested) — so quality cannot
  drop. Quality bugs (stalls→repeats, repeated formulations) cost **~$0.24/₪0.90 per session** on top.
  All headline numbers PINNED by `aiCostModel.test.ts`. Evidence class: CODE (real billed = device).
- **Controls built + tested (`costMeter.ts`):** persisted session/day/month counter (rollover tested);
  70%-of-ceiling **alert to Leo** (once per tier, via the existing `sendNotification` sink); at the
  ceiling a **graceful DEGRADE** (gpt-4o-mini-realtime + shorter replies) that **NEVER disconnects**
  Martita and NEVER tells her — `connected:true`/`martitaMessage:null` hold at 100% and 10× ceiling.
  This fixes the old `aiSpendGuard.checkSpendAllowed` (which cut her off at the cap — and was UNWIRED).
- **Mutant:** `cost-ceiling-disconnects-instead-of-degrades` (ceiling keeps the expensive model) →
  `costMeter.test.ts` red. Adversarial pass: verified no false savings (busy session saves $0), output
  cost invariant under the lifecycle, degraded replies still ≥200 tokens (not terse-to-rude).
- **Honest boundary:** the measurement + control LOGIC are CODE-proven; LIVE wiring into the WebRTC
  `response.done` usage + mid-session model swap is documented (COST_REPORT) but NOT rushed into the
  device-sensitive voice path pre-ship (per `.claude/rules/voice.md`). Real billed number = device.

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

### ▶ RESUME POINT (safe to /clear) — pushed at build 0.235.0
State: baseline GREEN (typecheck · **12,7xx tests** · build) — many consecutive clean full runs under
parallel load (flake fix holds). All work pushed to `rc5/cognitive-architecture-and-acceptance`.
Working tree's remaining `M` files are PRE-EXISTING (dirty at session start — NOT this run's; do not
touch). Nothing of this run is uncommitted.

**DONE (this long session):** unit mutation harness 15/15 · Playwright DOM harness 2/2 · O2 always-on
invariants · O-FLAKE root-fixed · O-LIFECYCLE core (11/11) + WIRED into the live realtime session
(5/5, no regression 139/139) · **H4 reliability AUDITED** (429/truncation/greeting-once already
handled — don't touch; only cross-screen identity test worth adding) · **ADVERSARY fuzz+injection
28/28** (data-not-instruction proven) · **O5 heartbeat alert CLOSED** (cron now probes /api/health →
RED + notify on outage) · O3/O4 documented (`PRODUCTION_PATH.md`).

**REMAINING — all in OPEN.md with execution-ready plans (zero re-derivation):**
1. **H1 ONE VOICE ENGINE** — full route-vs-remove plan is in OPEN.md (5 triggers, ~10-test blast
   radius incl. source-contract tests to migrate, single-voice-entry guard + mutant). Do it ALONE as
   its own reviewed commit — NOT batched (it will break/rewrite ~10 AbuCalendar tests by design).
2. **H3 COST** per 20-min, before/after — UNBLOCKED now (lifecycle wired; idle streaming stops).
   Instrument tokens/audio-min via `aiSpendGuard` + `latencyInstrumentation`; live counter + budget
   alert; quality must not drop.
3. **H2 ONLINE DEPTH** — full Tavily fan-out (Israel/world/culture/entertainment/society/health),
   10+ headlines held in session for follow-ups, cinema real-source-or-honest-cannot, verify 3 keys.
   PREVIEW-class (needs real keyed calls — not fully verifiable at CODE).
4. **Device proof** (Leo's iPhone): wired-lifecycle idle-cost + audible goodbye; voice audibility/STT/
   latency/warmth (docs/LEO-TESTS-ONLY.md).
5. Small: cross-screen identity consistency test (H4 #4); O5 client last-seen beacon (needs a store).

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

#### F6 — O-LIFECYCLE policy core built + tested; harness 15/15
- Built `src/services/sessionLifecycle.ts` — pure deterministic reducer (11/11 tests) for the
  brief's session contract: 12s stop-upstream · 25s ask-once ("את שם?") · 45s warm-goodbye+close ·
  never-close-mid-task (top rule) · 20-min single outward nudge · resume keeps the thread.
- Added 2 lifecycle mutants (never-close-mid-task removed; goodbye no longer closes) — both KILLED;
  unit harness now **15/15**. Honest scope: tested policy core + mutants only; wiring into the live
  realtime session is a flagged medium-risk follow-up (OPEN O-LIFECYCLE).

#### F7 — O-LIFECYCLE WIRED into the live realtime session (H-WIRE)
- `RealtimeVoiceSession` (`src/services/realtimeVoice.ts`) now drives `sessionLifecycle` on a bounded
  ~2s tick started at `dc.onopen`, stopped in `cleanup`. Effects through real seams: pause/resume the
  upstream mic track (cost); `speakLifecycleLine` → authoritative `createResponse`; warm goodbye sets
  `pendingGoodbyeClose` → `disconnect()` on the next `response_done` (never cut mid-utterance).
  `speech_started` → `markActivity` (reset clocks + resume upstream). midTask = `responseLeased` OR
  new `CalendarDraftController.hasActiveDraft()` (DRAFTING/AWAITING_CONFIRM).
- Deterministic wiring proof: `realtimeVoiceLifecycle.test.ts` (5/5) via `injectForTest(send, clock)`
  + injected clock (no WebRTC). No regression: realtime+voice **139/139**. Existing tests unaffected
  (the interval only runs on the real connect path, not under injectForTest).
- Evidence CODE — idle-cost saving + audible goodbye are device-only (feeds H3 cost).

### Run 1 mutation summary
**10 deterministic mutants + 1 negative control → 100% kill (10/10).** Started 80% → 100% after
closing TWO real blind spots (family label gender F1, Israeli-ID redaction F2); then extended into
Layer B (F3, 3 app mutants, all killed). Control never mis-fired. Every mutant restores its file in
`finally`; full suite re-confirmed green after each fix. Layers covered: A/Brain, A/Online,
A+B/Privacy, B/App-SeniorUX, B/App-DataIntegrity. NOT yet: App-RTL/nav/overflow (Playwright),
Platform (SW/idle), Journeys (card→WhatsApp/confirm→two-events).
