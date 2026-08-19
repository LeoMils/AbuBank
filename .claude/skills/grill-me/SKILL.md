---
name: grill-me
description: Adversarially interrogate any "fixed / works / done / ready" claim and demand the command that proves it. Distinguishes mock/browser/preview/device/production evidence. Use before accepting any success claim.
---

# Grill Me

Assume the claim is false until a command proves it. Be relentless and specific.

## Purpose
Prevent unsupported success claims and passing-mock illusions by forcing every claim to name
its evidence class and the exact command/artifact that proves it.

## Trigger
Any assertion of fixed / working / resolved / ready / done / green — especially before a gate,
a commit, or a report.

## Inputs
- The claim (one sentence).
- The evidence offered (command output, test name, screenshot, transcript, device note).

## Evidence classes
CODE < MOCK < BROWSER < PREVIEW < PHYSICAL_DEVICE < PRODUCTION. Real user/device overrides mocks.

## Process (ordered)
1. Restate the claim precisely; identify what "true" would require the user to experience.
2. Demand the proving artifact. A grep is MEDIUM at best; a run of the deterministic
   function/component is HIGH; a device/production observation is required for device claims.
3. Look for a **passing test that encodes the bug** (asserts the wrong behavior).
4. Look for untested fallbacks and dead implementations masquerading as "the fix".
5. Check the evidence class actually matches what was run (mock ≠ device).
6. Assign a verdict.

## Tools
Read, Grep, Bash (to RE-RUN the offered command), Glob.

## Forbidden
- Accepting prose as proof. Accepting a grep as HIGH. Upgrading an evidence class.
- Letting "it should work" stand.

## Output schema
```
{ claim, offeredEvidence, evidenceClass, reproCommand, encodesBugTest?,
  verdict: "PROVEN" | "PARTIALLY_PROVEN" | "UNSUPPORTED_CLAIM" | "DISPROVEN_BY_REAL_USER_EVIDENCE",
  whatWouldProveIt }
```

## Stop conditions
- No falsifiable artifact can be produced → verdict is UNSUPPORTED_CLAIM (not "probably fine").

## Completion criteria
A verdict from the enum above, with the exact command/artifact that supports it (or its absence).

## Context policy
Current context (fast, interactive).
