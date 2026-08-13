# OPEN ITEMS (unresolved, ranked)

## P1 — real gaps, code-findable
- **O1 · Mutation harness seeded, not complete** — `scripts/mutation-harness.mjs` built; 5
  deterministic mutants + control, 100% kill after closing 1 survivor (F1). REMAINING: seed the
  brief's ~30 across all layers — App (40px touch target, RTL break, dropped calendar field, broken
  back-nav, name overflow), Platform (SW update break, idle-timeout removal, mid-conversation
  update), Journeys (card→WhatsApp handoff, confirm→two-events). Each new survivor → a red test.
- **O2 · Invariants not always-on** — `companionSuite` invariants are key-gated (real model).
  No deterministic per-turn invariant assertion over the scenario corpus in CI. Blocks exit #5.

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
