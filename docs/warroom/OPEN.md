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
- **O-LIFECYCLE 🟠P1 — session idle-timeout lifecycle absent/undiscovered.** No deterministic module
  implements the brief's 12s stop-streaming / 25s ask-once-warmly / 45s warm-goodbye-and-close /
  one-tap-resume-with-thread / 20-min-outward-nudge. `IDLE_RUNTIME` is a cognitive-runtime state,
  `responseLifecycle` is audio-state only. Needs discovery: is it in the realtime session
  orchestrator (event-driven, no unit test) or genuinely missing? Then build + test. Also the brief's
  cost argument hangs off this (an idle session must stop costing money).

## Reliability finding (Run 1)
- **O-FLAKE 🟡P2 — CLOSED at root (v0.231), no retries.** Root cause: `buildCommunicationAction`
  → `composeWhatsAppMessageDetailed` made REAL provider calls (openai-server proxy, then a real Groq
  client fetch with 20s timeouts) once `VITE_GROQ_API_KEY` landed in `.env` — breaking the tests'
  own stated assumption ("providers are never reachable in unit tests"). Under parallel contention
  the 20s waits blew the per-test timeout (6–7s observed); isolation passed. Fix: `vi.stubGlobal`
  fetch to fail fast in both files → deterministic local composer. Hermetic, 6–7s → 167ms. No
  `test.retry` band-aid. Lesson logged: a stubbed provider assumption must be ENFORCED, not assumed.

## P2 — measurement / proof gaps
- **O3 · Rollback unproven** (exit #12) — no one-action revert + data-preservation proof.
- **O4 · Deploy path not dry-run** (exit #11) — documented only (`deploy:rc`).
- **O5 · Monitoring absent** (brief E4) — no heartbeat / error report / last-seen for
  post-ship silent failure. Diagnostics are in-app only (board: no external SLO sink).
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
