# QA_MISSES — every defect the owner reported that our checks should have caught

Standing law (Part 2): each entry is a PROCESS failure on the QA side — what it was, why
nothing caught it, and the check added so it cannot recur. The goal is an EMPTY file.

Length: 3 entries (all now have a closing check).

---

## QM-003 · people_lookup("גילעד") returned not_found — STT added a yud; dataset spells "גלעד"
- **What:** on the device, a misheard name (an inserted yud) returned not_found for a real family
  member. The Gilad problem again, on the INPUT side.
- **Why nothing caught it (input-side oracle problem):** the ground-truth matrix fed names spelled
  exactly as the dataset stores them, so it never exercised what speech recognition actually returns.
  A test that types the stored spelling proves nothing about a spoken lookup.
- **Check added (v0.248):** matres-lectionis skeleton + base/prefix dual-index in the resolver
  (misheard name resolves; prefix-initial names לאו/מור/מרתה match; ambiguous→ask, never not_found);
  `sttVariants()` generates realistic STT variants; `inputOracle.test.ts` runs all 65 names through
  generated variants (never verbatim) and asserts not_found=0 and wrong=0 on the recoverable set.
  STANDING Layer-1 rule now in force: no test feeds a value verbatim from the source it validates.

---

## QM-001 · Gilad returned relationToMartita: null — owner had to name her own grandson-in-law
- **What:** `people_lookup("גלעד")` → `relationToMartita: null`. Gilad is the husband of Ofir,
  Martita's granddaughter (a grandson-in-law). An 81-year-old corrected the assistant.
- **Why nothing caught it (the oracle problem):** `whoIs` derived the relation from `relationshipOf`,
  which has no term for "spouse of a grandchild" and returned null; whoIs fell back to `role` → null.
  Every family test asserted against the SAME dataset the resolver reads, so a circular test passed
  while the answer was wrong. No independent oracle existed.
- **Check added (v0.247):** (1) `grandchild_in_law` term + the `describePathBetween` fallback so
  whoIs is never null for a connected entity; (2) `relationNeverNull.test.ts` (Layer 1, 100% of
  entities) asserts NO entity resolves to null; (3) `FAMILY_GROUND_TRUTH.md` generated as the
  independent oracle (65 people, 0 gaps). Recurrence now fails the build.

## QM-002 · Anti-preamble instruction disobeyed on every tool call ("בסדר, אני אבדוק…")
- **What:** Abu spoke a check-announcement before 9 of 9 tool calls on the device, despite a strong
  "# Before a Tool Call" instruction with a build-failing guard.
- **Why nothing caught it:** the guard asserted the instruction TEXT was present — not that the
  behaviour held. The behaviour is audio-path and does NOT reproduce on the text instrument
  (CONVERGENCE_LOG: preTool=false on all probes), so no automated check could see it. Instruction
  presence ≠ behaviour.
- **Check added / status (v0.247):** the dead instruction text was deleted (it enforced nothing);
  the guard now locks only the real code-seed (instantAcknowledgement). The BEHAVIOURAL fix is
  structural in the realtime session layer and is a PHYSICAL_DEVICE verification item (OWNER_CHECKLIST
  item) — it cannot be closed by a text-instrument check. Logged honestly as device-open, not "fixed".
