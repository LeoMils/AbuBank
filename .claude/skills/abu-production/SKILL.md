---
name: abu-production
description: Drive the Abu AI AUTOMATABLE PRODUCTION CANDIDATE to completion under the machine gate. Use when resuming the production-convergence goal, closing a scorecard row, or checking whether the candidate is done. Loads the durable spec, evidence rules, defect loop, critical path and terminal rules.
---

# Abu Production — execution skill

The completion oracle is a machine gate, not prose. Run it first, work the open
rows, re-run until it exits 0.

## Command
- `npm run qa:production-gate` — deterministic. Exits nonzero while ANY automatable
  Critical/High scorecard row is open / evidence-deficient / stale / false-green /
  fake-blocker. `--fast` skips the git-commit staleness check. `--json` for raw.
- Logic: `src/engineering-os/productionGate.ts` (pure, adversarially tested in
  `productionGate.test.ts`). Never hand-green a row — green is DERIVED.

## Durable references (read these, don't duplicate them)
- `docs/engineering-os/qa/production-convergence/FINAL_EXECUTION_SPEC.md` — the full
  mission body: denominator, evidence ladder, scorecard schema, 13 contracts.
- `.../scorecard.json` — the derived contract (every Critical/High surface = a row).
- `.../PROMPT_AND_ASSUMPTION_AUDIT.md` — corrected prior-prompt flaws.
- `.../failure-corpus.json`, `.../risk-register.json`, `.../worklog.md`, `.../release-candidate.json`.
- Certified architecture: `docs/engineering-os/adr/ADR-0001-abu-realtime-conversational-architecture.md`.

## Evidence rules
Ladder: `STATIC < UNIT < INTEGRATION < PRODUCTION_ADAPTER < BROWSER <
DEPLOYED_PREVIEW < LIVE_PROVIDER < PHYSICAL_DEVICE < PRODUCTION`. Require the
strongest class technically relevant. Injected-event ≠ live. Test-only ≠ device.
`physical`/`external` require `blockerProof`; never hide automatable work behind them.

## Defect loop (every defect)
reproduce → first divergence → failing-first regression → fix the MECHANISM →
mutation-prove → strongest available production path → update failure corpus → continue.

## Critical path (order)
0 restore+deploy/fingerprint · 1 reconcile inventory+truthful gate · 2 audit AbuCalendar ·
3 Calendar under ADR-0001 (failing-first) · 4 unify Calendar/Comm/general · 5 Hebrew/
complaint/repair/repetition/long-session · 6 instrumentation+runners · 7 live-provider
experiments or prove blocker · 8 whole-product property/race/fault/mutation QA · 9 hostile
review, remove false greens · 10 push+Preview/RC+fingerprint+rollback · 11 gate exit 0.

## Stop enforcement (optional arming)
`scripts/abu-stop-guard.mjs` (wired in `.claude/settings.json` Stop hook) blocks a
premature turn-end ONLY when armed via `.claude/.abu-goal-active`, and only while the
cached gate reports open work. Loop-safe (releases after 3 consecutive blocks).
Arm: `touch .claude/.abu-goal-active`. Disarm: delete it.

## Terminal rules
Only **PRODUCTION CANDIDATE PROVEN** (gate 0 + physical passed) or **AUTOMATABLE
PRODUCTION CANDIDATE PROVEN** (gate 0, only evidenced physical/external remain).
Never merge main; never deploy Production.
