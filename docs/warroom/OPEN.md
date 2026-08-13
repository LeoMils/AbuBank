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
- **O-LIFECYCLE ✅ core + WIRED (v0.233); device proof pending.** `sessionLifecycle.ts` reducer
  (11/11) is now DRIVEN by the live `RealtimeVoiceSession` (~2s tick): 12s pause-upstream-mic,
  25s ask-once (את שם), 45s goodbye-then-close-on-response_done, 20-min nudge; speech_started resets
  clocks + resumes upstream; never acts mid-task (responseLeased OR `CalendarDraftController.
  hasActiveDraft`). Wiring test `realtimeVoiceLifecycle.test.ts` (5/5) via injectForTest + injected
  clock; no regression (realtime+voice 139/139). **Residual (device-only):** the actual idle-cost
  saving and the audible warm goodbye/latency are CODE-class here — need iPhone proof. Feeds H3 (cost).

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

- **H1 · ONE VOICE ENGINE — EXECUTION-READY PLAN (its own reviewed commit; NOT rushed).**
  **First divergence:** two STT engines exist. AbuCalendar's own capture+transcribe = `index.tsx`
  `handleVoiceRecord()` (line ~359: getUserMedia → MediaRecorder → `transcribeCalendarAudio` (Groq)
  → `processVoiceTranscript`), separate from Abu AI's engine.
  **Triggers (5):** index.tsx L~943 (retry, bypassGuard), L1379 (product button), L1557
  (`onToggleRecord`→VoiceCard), L1590 (product button), L1629 (`GuidedMicQaPanel`, debug).
  **Blast radius (~10 test files), incl. SOURCE-CONTRACT tests that must be migrated, not just kept:**
  `voiceRecordGuard.test.ts:52` asserts INDEX_SOURCE contains `handleVoiceRecord({ bypassGuard: true })`;
  `micCapture.test.ts` asserts index imports `createSilenceDetector`; plus `calendarTranscribe`,
  `guidedQa`, `voiceCardSlots`, `voiceTrace`, and the 3 named (`voiceAutoCreate`, `voicePersistence`,
  `voiceConfirmationP02`).
  **Decision — ROUTE (not delete):** the calendar mic button becomes `setScreen(Screen.AbuAI)` (opens
  the ONE engine). **Keep** the pure/tested pieces the 3 named tests cover: `processVoiceTranscript`
  (pure parser), `createAppointmentSafe`/`addAppointment` (persistence), `VoiceCard.tsx` (still the
  confirm UI if Abu AI routes a calendar draft back). **Remove** the duplicate CAPTURE: the
  getUserMedia/MediaRecorder body of `handleVoiceRecord` + `transcribeCalendarAudio` usage + the
  now-dead voice-capture state in index.tsx. **Migrate** the source-contract tests to assert the NEW
  truth (calendar routes to Abu AI; no getUserMedia in the calendar product path) — justify each in
  DECISIONS (a test encoding the removed engine is legitimately updated, not weakened).
  **Guard:** add a "single voice entry point" contract test — AbuCalendar product path contains NO
  getUserMedia/MediaRecorder/`transcribeCalendarAudio`; the mic CTA routes to Abu AI. Then a mutant:
  reintroducing a calendar getUserMedia fails that guard.
  **Verify:** the 3 named tests green + full AbuCalendar suite green + typecheck + build. Est: a
  focused session (large diff across index.tsx + ~10 tests) — do it ALONE, not batched.
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
- **H4 · reliability tail — AUDITED (report before change). 3 of 4 already handled; no risky rip.**
  1. **429 backoff/retry — HANDLED.** `AbuAI/service.ts:1313` parses `Retry-After` (default 3s, cap
     10s) + records a provider cooldown (L803); `realtimeVoice.ts:754` reconnects with 1s/2s backoff
     (max 2). Adequate. *Optional:* confirm `/api/abuai-online` (Tavily) also backs off vs its bounded
     timeout — small, not a bug.
  2. **Audio truncation — HANDLED (primary path).** Realtime uses `interrupt_response:true` +
     server auto-truncates unplayed assistant audio on barge-in (WebRTC), plus `response.cancel` on
     tap (`realtimeVoice.ts:81/500/818`). The cascaded pipeline is turn-based (no mid-truncation
     needed). Adequate.
  3. **Second voice at session start — HANDLED.** Greeting-once is enforced: `sessionOrchestrator`
     Law 8 + `liveSession.ts` `GREETED_KEY` (exactly once per conversation id, never on reconnect;
     "documented fix for repeated greetings"). Adequate.
  4. **People store reachable from every screen — PARTIAL BY DESIGN, not broken.** TWO intentional
     stores: family GRAPH (`knowledge/family_data.json`→`loadGraph`, no-PII, read by AbuAI +
     AbuCalendar via `familyResolve`) and CONTACTS (`familyContactsStorage`, PII phone/photo, owned by
     AbuWhatsApp, reached by AbuAI through the registered `whatsappAdapter`/`phoneAdapter`,
     `AbuAI/communication/registry.ts:26`). AbuCalendar uses the graph for participant NAMES (no phone
     need). Split is deliberate (privacy: PII isolated). *Real check worth adding (not a proven bug):*
     a cross-screen IDENTITY-consistency test — "message Mor" / "Mor's birthday" / calendar
     participant "Mor" all resolve the SAME person (graph↔contacts link). Buildable, low-risk.
  **Verdict:** do NOT change 1–3. Only #4's cross-screen-identity consistency test is worth building.

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
