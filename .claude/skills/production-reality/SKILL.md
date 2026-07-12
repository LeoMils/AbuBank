---
name: production-reality
description: Compare automated evidence against real conversation/device evidence and produce a red/yellow/green capability table where physical evidence overrides simulated. Use to keep the Acceptance Board honest.
---

# Production Reality

Green tests are not green product. This skill reconciles what the suite claims with what real
users/devices experienced, and physical reality wins.

## Purpose
Maintain an honest per-capability status where the reported color reflects the WEAKEST honest
evidence class, and real user/device evidence overrides any number of passing mocks.

## Trigger
Any PASS/green claim; updating `docs/engineering-os/PRODUCTION_ACCEPTANCE_BOARD.md`; pre-release.

## Inputs
- A capability (Voice, Online, Calendar, Memory, Follow-up, …).
- Automated evidence (test names/results) AND real evidence (transcripts, device notes).

## Evidence classes
CODE / MOCK / BROWSER / PREVIEW / PHYSICAL_DEVICE / PRODUCTION — tracked separately per capability.

## Process (ordered)
1. Collect automated evidence for the capability and tag its true class (mock vs real provider).
2. Collect real evidence (device transcripts, user reports, Preview observations).
3. If real evidence contradicts automated → status is red/yellow regardless of test count.
4. Set status to the color implied by the WEAKEST honest class needed for acceptance.
5. Record last evidence, commit, version, first divergence (if failing), blocker, next action.

## Tools
Read, Grep, Bash (to re-run a deterministic check), Glob.

## Forbidden
- Reporting the highest evidence class instead of the lowest honest one.
- Turning a capability green on mock evidence alone when acceptance needs device/production.

## Output schema
```
{ capability, byClass:{code,mock,browser,preview,device,production},
  status:"green"|"yellow"|"red", lastEvidence, commit, version, firstDivergence?, blocker?, nextAction }
```

## Stop conditions
- Acceptance requires a class you cannot observe (e.g. device) → status stays yellow/red, flag it.

## Completion criteria
A capability row whose color is defensible by the weakest honest evidence, with next acceptance action.

## Context policy
Isolated when sweeping many capabilities; current for a single one.
