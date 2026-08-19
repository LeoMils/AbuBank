---
name: gold-replay
description: Convert a real conversation into a deterministic, reusable replay that preserves intent, corrections, follow-ups and failures — with expected tool route and evidence class. Use to turn real usage into durable acceptance.
---

# Gold Replay

Turn a real conversation into a permanent, deterministic test of the EXPERIENCE — not a
phrase-specific patch.

## Purpose
Capture a real (redacted) conversation as a replay artifact so the product's behavior on that
real moment is locked in and regressions are caught.

## Trigger
A real conversation (device transcript, user session) worth protecting — especially a failure
or a hard-won success.

## Inputs
- A real transcript (turns, user intent, corrections, follow-ups, outcome).
- The expected tool route per turn and the acceptable outcome.

## Evidence classes
The replay itself is CODE (deterministic). It ENCODES what real evidence (device/production) showed.

## Process (ordered)
1. Redact all PII (phone/medical/financial/street) via the evolution redaction path.
2. Preserve the user's true intent, each correction, each follow-up, and the failure/success.
3. For each turn record: expected tool route (calendar/online/memory/…), expected outcome,
   and the evidence class the outcome must reach for acceptance.
4. Generalize: assert the behavior/intent, not the exact phrasing, so near-variants also pass.
5. Emit a reusable replay artifact (shared evidence schema) + a runnable test.

## Tools
Read, Write (replay artifact + test), Grep, Bash (run the replay).

## Forbidden
- Storing un-redacted transcripts. Phrase-specific assertions that only pass the one wording.
- Editing product behavior to make a replay pass (that's a separate fix + failure-to-regression).

## Output schema
```
{ replayId, source:"device"|"session", redacted:true, turns:[{ user, expectedRoute,
  expectedOutcome, requiredEvidenceClass }], generalization, artifactPath, testPath }
```

## Stop conditions
- Transcript cannot be safely redacted → do not store it; report why.

## Completion criteria
A redacted, generalized, runnable replay artifact + test that reproduces the real moment deterministically.

## Context policy
Current context (author one) or isolated (batch many).
