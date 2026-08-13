# OPEN ITEMS (unresolved, ranked)

## P1 — real gaps, code-findable
- **O1 · Mutation harness seeded, not complete** — `scripts/mutation-harness.mjs` built; **10
  deterministic mutants + control, 100% kill** after closing 2 survivors (F1 family label, F2
  Israeli-ID). Now spans Brain/Online/Privacy + App (touch-target 40px ✓killed, body-text ✓killed,
  calendar drop-field ✓killed). REMAINING to seed: Platform (SW-update break, idle-timeout removal,
  mid-conversation update), Journeys (card→WhatsApp handoff, confirm→two-events). SEPARATE harness
  needed for App RTL-break / back-nav / name-overflow (Playwright/DOM-render — the unit harness runs
  `vitest run`, not `playwright test`; do NOT force these into it as weak proxies).
- **O2 · Invariants not always-on — CLOSED (v0.230).** `src/eval/alwaysOnInvariants.test.ts` now
  asserts the deterministic A4 invariants (no phone aloud / no-announce / no red wine / feminine
  self-ref) on every turn of a key-free corpus via `runFullTurn`, with a teeth test. Found + fixed a
  dead Hebrew-`\b` regex that had made the no-announce check a silent no-op. Residual: model-layer
  invariants (warmth, full distress wording) still need the key-gated companion suite + credits.

## Feature gaps surfaced by the mutation sweep
- **O-LIFECYCLE 🟡 — policy core BUILT + tested (v0.232); live wiring PENDING.** `src/services/
  sessionLifecycle.ts` is the deterministic single-source reducer (11/11 tests) for 12s stop-upstream
  / 25s ask-once / 45s warm-goodbye+close / never-close-mid-task / 20-min single outward nudge /
  resume-keeps-thread. Two lifecycle mutants added (both KILLED). **Remaining (medium-risk, not done
  here):** wire it into the live realtime audio session so the clocks actually drive it on device —
  event-driven integration touching the session orchestrator (four clocks). That is the only part
  left; it needs a careful, separately-reviewed change (and device proof for the cost claim).

## Reliability finding (Run 1)
- **O-FLAKE 🟡P2 — CLOSED at root (v0.231), no retries.** Root cause: `buildCommunicationAction`
  → `composeWhatsAppMessageDetailed` made REAL provider calls (openai-server proxy, then a real Groq
  client fetch with 20s timeouts) once `VITE_GROQ_API_KEY` landed in `.env` — breaking the tests'
  own stated assumption ("providers are never reachable in unit tests"). Under parallel contention
  the 20s waits blew the per-test timeout (6–7s observed); isolation passed. Fix: `vi.stubGlobal`
  fetch to fail fast in both files → deterministic local composer. Hermetic, 6–7s → 167ms. No
  `test.retry` band-aid. Lesson logged: a stubbed provider assumption must be ENFORCED, not assumed.

## HEAVY ITEMS — not done this run, RESUMABLE PLANS (zero re-derivation)
These were deliberately NOT rushed — each is a real feature/refactor with device or provider
dependencies; half-doing them risks breaking working behavior. Plans below are ready to execute.

- **H1 · ONE VOICE ENGINE (brief #6) — AbuCalendar has a SEPARATE mic.** First divergence found:
  AbuCalendar owns its own capture+transcribe path (`src/screens/AbuCalendar/VoiceCard.tsx` +
  `calendarTranscribe.ts`, its own MediaRecorder→Groq), distinct from Abu AI's voice engine — a
  "two runtime paths for one capability" defect. Plan: either (a) the AbuCalendar mic button routes
  into Abu AI (`setScreen(Screen.AbuAI)` + hand off the calendar intent), or (b) remove the separate
  mic and let calendar creates go through Abu AI. Heavy test surface: `voiceAutoCreate`,
  `voicePersistence`, `voiceConfirmationP02`, `calendarTranscribe` — must stay green. Medium-risk
  UI+voice change → do as its own reviewed commit, then add a mutant that a second engine reappearing
  fails a "single voice entry point" contract test.
- **H2 · ONLINE DEPTH (brief #4).** Today `/api/abuai-online` returns a one-line answer. Plan: use
  the FULL provider (Tavily) result set — fan out across Israel/world/culture/entertainment/society/
  health, return 10+ headlines WITH sources, and HOLD them in session so a follow-up ("more on #3")
  answers from the same retrieval (a session cache keyed by turn). Cinema: real source or honest
  "cannot" (never fabricate). Verify all THREE provider keys live (Tavily/Brave/one more) via the
  existing bake-off (`docs/eval/ONLINE_BAKEOFF.json`). Evidence class = PREVIEW (real keyed call) —
  NOT fully verifiable at CODE. Wire behind the existing honesty gate (zero sources ⇒ decline).
- **H3 · COST per 20-min conversation (brief #5).** Plan: instrument token/audio-minute usage per
  turn (there is `aiSpendGuard` + `latencyInstrumentation` to build on), sum a representative 20-min
  session BEFORE (current stalls/repetitions inflate it) and AFTER the lifecycle+quality fixes, and
  quantify: every stall forced a repeated turn (wasted output), every repetition wasted tokens. Add a
  live counter + budget alert; at the ceiling degrade gracefully, NEVER disconnect her. Quality must
  not drop a millimetre — reject any saving that costs quality. Depends on O-LIFECYCLE being wired
  (H-wire) to actually stop idle streaming.
- **H4 · reliability tail (brief #6 rest):** 429 backoff+retry, audio truncation, the second voice
  at session start, and "people store reachable from every screen" — each a focused audit+fix;
  investigate current state first (some may already be handled) before changing.

## P2 — measurement / proof gaps
- **O3 · Rollback — mechanism PROVEN, execution human** (`PRODUCTION_PATH.md`). One-action Vercel
  re-alias; her client-side IndexedDB/localStorage data untouched → no data loss. Live run needs auth.
- **O4 · Deploy path — documented + build dry-run GREEN** (`PRODUCTION_PATH.md`). deploy/alias steps
  need Vercel auth (human); Production `--prod` is a STOP condition.
- **O5 · Monitoring — heartbeat EXISTS, alerting MISSING** (`PRODUCTION_PATH.md`). `/api/health`
  liveness + nightly cron exist; the code-buildable gaps: external uptime poll + alert SINK, a client
  "last seen" beacon, and an ErrorBoundary error beacon. Alert/telemetry SINK is an external decision.
- **O6 · Per-screen sweep not enforced** (exit #8) — render/overflow/contrast/≥56px/RTL at
  412×870 in both themes is partial across specs, not one gate.
- **O7 · Data-through-not-instruction injection** (brief C2/Adversary) — no suite proving
  message content / contact names / calendar titles / search results cannot inject instructions.

## P3 — tracked notes
- **O8 · Free-tier Groq key scrapable from bundle** (see DECISIONS D2). Non-billable, allowed by
  contract. Residual: quota exhaustion / abuse. Mitigation (proxy or server-side relay + rotation)
  is a product decision for Leo — NOT a code defect. No action taken.

## Device-only (NOT code-fixable — belongs to Leo, see docs/LEO-TESTS-ONLY.md)
- Audibility & full-sentence heard · real elderly Argentine-Hebrew STT · latency feel ·
  barge-in feel · warmth. These are the board's standing RED/YELLOW rows.
