---
name: incident-report
description: Produce a structured post-mortem (timeline, impact, expected/actual, first divergence, root cause, fix, regression, evidence classes, remaining limits) that links to a red regression test. Use after any production/device failure.
---

# Incident Report

A structured, honest post-mortem that ends in a regression test — not a story.

## Purpose
Turn a production/device failure into a durable record with a first-divergence root cause and a
linked regression, so the same class of failure is prevented, not just described.

## Trigger
Any production or physical-device failure, or a serious Preview failure.

## Inputs
- What happened (symptom), when, on what surface (device/preview/production), and the evidence.

## Evidence classes
The incident evidence is whatever was observed (often PHYSICAL_DEVICE/PRODUCTION); the linked
regression test is CODE.

## Process (ordered)
1. Timeline: what happened, in order, with timestamps where known.
2. Impact: which capability, how many moments, how severe for Martita.
3. Expected vs actual behavior.
4. First divergence: earliest point actual ≠ expected (`file:line` where possible).
5. Root cause (mechanism, not blame).
6. Fix (or proposed fix) + the linked RED regression (delegate to `failure-to-regression`).
7. Evidence classes for both the failure and the fix proof.
8. Remaining limits / what is still unproven (esp. device-only).

## Tools
Read, Grep, Write (the report under `docs/engineering-os/incidents/`), Bash (probes).

## Forbidden
- A post-mortem with no linked regression test.
- Claiming "fixed" on CODE/MOCK evidence when the failure was PHYSICAL_DEVICE/PRODUCTION.
- Assigning blame instead of a mechanism.

## Output schema
```
{ id, surface, timeline[], impact, expected, actual, firstDivergence,
  rootCause, fix, regressionTestPath, evidence:{failureClass, fixClass}, remainingLimits[] }
```

## Stop conditions
- Root cause cannot be established → report as "root cause not established; evidence needed", not a guess.

## Completion criteria
A report file with all sections above and a linked red regression test (or an explicit reason none exists yet).

## Context policy
Current context.
