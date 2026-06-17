# FAILURE AUTOPSY AND RECOVERY DOCTRINE
## AbuBank Voice + Calendar + Reminder Pipeline

**Audience:** Engineering, Product, QA, Release Manager
**Status:** Living doc — update on every recurrence
**Branch at write time:** `feat/calendar-revolution` (HEAD `dfc746a`)
**Tests at write time:** 2397/2397 passing. 200 fixtures, 0 intent-detection divergences.

---

## PURPOSE

This document is the institutional memory of what has gone wrong on the
calendar-revolution branch, why it happened, and what guards now prevent
recurrence. It is mandatory reading before any subsequent voice-pipeline
work.

---

## INCIDENT LOG

### 1. Wrong runtime / wrong branch
**What happened.** During earlier "war-room" sessions live browser was
loading an older bundle than the branch under work, producing the
illusion of regressions or "voice broken" when in fact the code on the
branch was correct.
**Why.** No DEV/build-marker in the bundle. No explicit branch verifier
in the page. Stale service worker cache.
**Prevention now.**
- A root-level DEV marker exists (see commit `b9b1452`).
- A stale-dev SW auto-unregister hook exists (commit `79fba32`).
- All future browser QA MUST verify the DEV marker matches `git log --oneline -1`.

### 2. UI fixes attempted before semantic truth was proven
**What happened.** Visual confirmation cards were polished while the
underlying intent / date / time / person resolution was still wrong.
This produced "looks fixed" reports that did not survive a second
sentence from Martita.
**Why.** Bias toward what we could see in a browser instead of what we
could prove in a test.
**Prevention now.**
- Diagnostic harness must be GREEN before any UI is touched (see
  PHASE 0 of every recovery mission).
- "STATIC_ONLY" evidence is now a tag separate from "PROVEN_BY_TEST".
- UI commits must reference the test that proves the underlying logic.

### 3. Reliance on isolated unit tests instead of end-to-end pipeline
**What happened.** Reminder parser tests passed in isolation while
fixture #14 (`bridging "שלושים" → "שים"`) silently failed end-to-end.
**Why.** A regex in `detectReminderIntent` matched a substring across
Hebrew word boundaries. Unit tests for the verb list were green;
end-to-end fixtures revealed it.
**Prevention now.**
- 200+ fixture harness now exists.
- Hebrew word-boundary lookarounds `(?<![֐-׿])...(?![֐-׿])` are
  mandatory for any verb/noun set that overlaps with longer words.

### 4. Voice flow was patched per-symptom instead of modeled
**What happened.** Each voice bug got its own micro-fix, accumulating a
9+ state machine that was incoherent and impossible to test as a whole.
**Why.** No single contract for what the voice flow was supposed to do.
No source of truth for "what is the legal sequence."
**Prevention now.**
- VOICE_SEMANTIC_PIPELINE_CONTRACT.md (sibling document) is the contract.
- Future voice changes must reference a stage in the contract.

### 5. AbuReminder was built before AbuCalendar voice was proven
**What happened.** Reminder UI shipped before the underlying text
pipeline could reliably distinguish "appointment" from "reminder."
**Why.** Feature pull from product side without an
intent-disambiguation contract.
**Prevention now.**
- The diagnostic harness's first job is to assert intent. No reminder
  feature can ship without harness greenness on reminder fixtures.

### 6. Product documents drifted away from the immediate blocker
**What happened.** Vision documents grew while the core blocker
(notifications not firing when app is closed) stayed unaddressed.
**Why.** No prioritization gate between "long-term vision" work and
"production blocker" work.
**Prevention now.**
- EXECUTION_ROADMAP.md is the prioritization gate.
- RELIABILITY_REALITY_CHECK.md states explicitly what is and isn't safe.

### 7. Claude Code branch drift
**What happened.** Code was being modified on multiple branches in
parallel without a clear primary.
**Why.** Multiple Claude Code sessions / multiple operator instructions
without a branch lock.
**Prevention now.**
- Every recovery mission starts with `git branch --show-current` and
  asserts the expected branch.
- "Do NOT switch branches" is a hard rule in every mission preamble.

### 8. Push rule violations
**What happened.** Earlier sessions pushed without explicit approval.
**Why.** Stop hooks were misread as authorization.
**Prevention now.**
- Every mission preamble explicitly says: stop hook is NOT
  authorization. Stop hook output must be acknowledged and IGNORED.
- Commits stay local unless the user explicitly authorizes a push.

### 9. Live browser showed old components
**What happened.** VoiceCard imports surfaced through old code paths
even after rewrite (commit `614f33d`).
**Why.** Import-graph severance was incomplete.
**Prevention now.**
- Build markers exist.
- "dirty title blocker" tests run on every CI to assert that no
  forbidden token (debug / sentence-blob) reaches confirmation text.

### 10. Calendar/reminder logic boundary unclear
**What happened.** Reminder triggers ("תזכירי") and appointment triggers
("תקבעי") were treated as overlapping vocabularies. Routing decisions
flipped depending on word order.
**Why.** No explicit 10-rule routing precedence.
**Prevention now.**
- `detectReminderIntent` now has explicit rule precedence (1..10),
  documented inline.
- All routing changes require an updated rule comment + a fixture.

---

## RECOVERY DOCTRINE — STANDING ORDERS

1. **Truth before code.** Run baseline. If baseline fails, STOP.
2. **Tests before UI.** Logic must be GREEN before any visual change.
3. **Fixture before fix.** A bug doesn't exist until a fixture
   reproduces it. A fix doesn't ship until the fixture is green.
4. **Lookarounds for Hebrew substring overlaps.** Always.
5. **No raw transcript downstream.** UI / save / readback consume
   semantic drafts only.
6. **Save gating is the last line.** If any required field is missing
   or ambiguous, save MUST be blocked with a reason string.
7. **Memory/* drift is a build artifact.** Restore. Never commit.
8. **Stop hooks are not authorization.** Acknowledge, ignore.
9. **Branch lock.** Do not switch branches mid-mission.
10. **Pushes require explicit operator approval.** Never silent.

---

## RECURRENCE GUARDS NOW IN PLACE

| Guard | File / Test | Catches |
|-------|-------------|---------|
| Fixture harness | `voicePipelineHarness.test.ts` | Intent drift |
| Golden semantic tests | `voicePipelineGolden.test.ts` | Date/time/person regressions |
| Hard semantic asserts | end of harness.test.ts | Specific Martita sentences |
| Hebrew word boundaries | `reminderParser.ts` regex set | Substring false-positives |
| Self-correction patterns | `localParser.cleanTranscript` | "X סליחה Y" handling |
| Determinism check | harness.test.ts | Hidden randomness |
| 10-field row schema | harness.test.ts | Missing diagnostic data |
| Dirty-title blocker | calendar tests | Raw transcript leakage |
| DEV marker | root component | Stale-bundle blindness |
| Stale SW unregister | calendar bootstrap | Cached-SW blindness |
