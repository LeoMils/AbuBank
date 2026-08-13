# OPEN ITEMS (unresolved, ranked)

## P1 — real gaps, code-findable
- **O1 · Mutation harness seeded, not complete** — `scripts/mutation-harness.mjs` built; **10
  deterministic mutants + control, 100% kill** after closing 2 survivors (F1 family label, F2
  Israeli-ID). Now spans Brain/Online/Privacy + App (touch-target 40px ✓killed, body-text ✓killed,
  calendar drop-field ✓killed). REMAINING to seed: Platform (SW-update break, idle-timeout removal,
  mid-conversation update), Journeys (card→WhatsApp handoff, confirm→two-events). SEPARATE harness
  needed for App RTL-break / back-nav / name-overflow (Playwright/DOM-render — the unit harness runs
  `vitest run`, not `playwright test`; do NOT force these into it as weak proxies).
- **O2 · Invariants not always-on** — `companionSuite` invariants are key-gated (real model).
  No deterministic per-turn invariant assertion over the scenario corpus in CI. Blocks exit #5.

## Feature gaps surfaced by the mutation sweep
- **O-LIFECYCLE 🟠P1 — session idle-timeout lifecycle absent/undiscovered.** No deterministic module
  implements the brief's 12s stop-streaming / 25s ask-once-warmly / 45s warm-goodbye-and-close /
  one-tap-resume-with-thread / 20-min-outward-nudge. `IDLE_RUNTIME` is a cognitive-runtime state,
  `responseLifecycle` is audio-state only. Needs discovery: is it in the realtime session
  orchestrator (event-driven, no unit test) or genuinely missing? Then build + test. Also the brief's
  cost argument hangs off this (an idle session must stop costing money).

## Reliability finding (Run 1)
- **O-FLAKE 🟡P2 — flaky tests under full-suite parallel load.**
  `src/screens/AbuAI/communication/capability.test.ts` and `communication/productionGates.test.ts`
  each intermittently fail ONE test under the full 476-file parallel run (observed 6–7s runtimes =
  timeout under contention), but pass 28/28 in isolation. Not caused by this run's changes (only the
  harness script + version literals + docs were touched). A green suite that flakes is a liability —
  investigate timers/timeouts/shared state; consider `test.retry` only as a stopgap, fix root cause.

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
