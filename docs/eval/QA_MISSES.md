# QA_MISSES — every defect the owner reported that our checks should have caught

Standing law (Part 2): each entry is a PROCESS failure on the QA side — what it was, why
nothing caught it, and the check added so it cannot recur. The goal is an EMPTY file.

Length: 4 entries (all now have a closing check).

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

## QM-004 · relationshipBetween narrated a graph PATH, not the kinship TERM — and the tests could not tell (ORACLE-FROM-IMPLEMENTATION)
- **What:** the owner rejected the relation output THREE times. It returned a path traversal artifact
  ("עדי הוא האחיין של החמות של גלעד") instead of the term a Hebrew speaker says ("עדי בן דוד של אשתו של
  גלעד"). Both are TRUE; the path names whichever node the search passed through (the mother-in-law),
  not the relationship (cousin — via the SPOUSE). Rafi↔Leo must be one word, גיס — not "the husband of
  my mother's daughter", equally true and absurd.
- **Why nothing caught it (the class):** the tests asserted `relationshipBetween(a,b)` against WHATEVER
  THE RESOLVER RETURNED. The expected value was derived FROM the implementation, so the oracle was the
  code — structurally incapable of detecting the code was wrong. `relationChainShort.test.ts` locked in
  the current output as "correct" twice in a row ("בני משפחה", then a path), each an implementation
  artifact, never what a person would say. **An oracle derived from the implementation cannot detect that
  the implementation is wrong.**
- **Check added (v0.285):** (1) MECHANISM — a term-first resolver `relationBetween` (kinship term →
  term via the SPOUSE, spouse-expansion both directions → only then a path, FLAGGED `termAbsent`); the
  in-law derivation now covers partners + former spouses (Yael is Leo's גיסה). (2) ORACLE — 
  `relationTermMatrix.test.ts` asserts HAND-AUTHORED human answers (בן דוד של אשתו, גיס, גיסה, אשת בן
  הדוד…), authored from what a family member says, NOT read from the resolver. (3) INVARIANTS — over the
  FULL ordered pair matrix: never "בני משפחה", never routed through Martita unless she is one of the two.
- **Standing rule:** audit for expected values COPIED FROM A RUN (snapshot/golden/characterization tests
  regenerated from the code). Those validate the implementation, not the requirement, and cannot fail on
  a wrong implementation. A correctness oracle must be authored from the spec/real answer.
