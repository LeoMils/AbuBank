---
name: failure-to-regression
description: Turn a real failure into a red regression test FIRST, via first-divergence + competing hypotheses, then a generalized regression family. Use for every bug or incident before fixing.
---

# Failure to Regression

No fix before a red test. Find the FIRST divergence, not a plausible-sounding cause.

## Purpose
Convert a symptom into a deterministic red test and a generalized regression family, so the
bug can never silently return and the fix is aimed at the true mechanism.

## Trigger
Any bug, incident, or real-user failure — before writing a fix.

## Inputs
- The symptom (what the user saw) + evidence (transcript/log/screenshot/device note).

## Evidence classes
Symptom evidence may be PHYSICAL_DEVICE/PRODUCTION; the regression test is CODE (deterministic).

## Process (ordered)
1. Capture the symptom exactly and preserve the evidence (link it).
2. Trace to the **first divergence**: the earliest step where actual ≠ expected. Not the last.
3. Form 2–3 competing hypotheses for that divergence; try to FALSIFY each with a quick probe.
4. Write a RED test that reproduces the failure at the divergence point.
5. Generalize into a regression FAMILY (near-variants, other languages/genders/dates) so the fix
   can't be phrase-specific.
6. After the fix lands (separate step), confirm the family is green and scan for nearby regressions.

## Tools
Read, Grep, Bash (run probes/tests), Write (the red test).

## Forbidden
- Writing the fix before the red test exists.
- Blaming the last-touched code without proving the first divergence.
- A single phrase-specific assertion with no generalization.

## Output schema
```
{ symptom, evidenceRef, firstDivergence:{file,line,expected,actual},
  hypotheses:[{h, falsifyProbe, survived:boolean}], redTestPath, regressionFamily[], nearbyChecks[] }
```

## Stop conditions
- First divergence cannot be located from available evidence → gather more evidence; do not guess a fix.

## Completion criteria
A red test at the first divergence + a named regression family, before any fix is written.

## Context policy
Current context.
