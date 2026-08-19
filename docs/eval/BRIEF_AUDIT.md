# BRIEF_AUDIT — auditing the FULL QA AND FIX brief against the code

The brief was written from outside the repo and invites challenge. Findings below are
checked against the actual code. Each is logged; where the brief conflicts with a
standing in-repo rule or a device-proven decision, the stricter/evidence-based reading wins
(and is recorded in DECISIONS.md).

## A1 · The "adversarial reviewer subagent" conflicts with the repo's V4 operating rule
The brief (Part 0) asks for a subagent adversarial reviewer each iteration. The repo's
permanent rule (`.claude/rules/abuai-live-parity-v4.md`, root CLAUDE.md) is explicit: **one
foreground writer, no Agent/subagents/background/forks/worktrees/parallel mutation.** RESOLUTION:
obey the repo rule — run the adversarial pass INLINE (below), not as a subagent. This is the
stricter reading (the repo author set that rule with device context the brief author lacks).

## A2 · The anti-preamble preamble is DEVICE/AUDIO-only — unmeasurable on the text instrument
Verified: the CONVERGENCE_LOG reproduction gate found `preTool=false` on all four probes on
`gpt-realtime` text mode — the preamble did NOT reproduce off-device. So M1's "no preamble" and
its structural silence fix CANNOT be measured on the instrument; they are PHYSICAL_DEVICE items
(Part 2 owner domain). Deleting the dead instruction text is safe + measurable (bundle shrink);
the lifecycle mechanism needs device verification. Do not claim the preamble "fixed" from code.

## A3 · M1 "truncate on barge-in" CONFLICTS with a device-proven decision
`liveSession.ts` sets `LIVE_INTERRUPT_RESPONSE=false` DELIBERATELY: a documented device trace
showed the loudspeaker echo re-entered the mic, the server VAD heard Abu's own voice as
`speech_started`, and with interrupt_response TRUE the server truncated her after one word
("one word then text-only"). M1 asks to truncate to playback position on barge-in — flipping that
back risks reintroducing the exact echo-truncation defect. RESOLUTION: do NOT flip
interrupt_response blind. The correct barge-in truncation must be paired with the echo fix and
verified on a device. Logged as device work, not shipped this session.

## A4 · M5 "bundle under 5,000 chars" is NOT reachable by deleting instruction text alone
Measured: after removing the 10,902-char family portrait (v0.245) AND the ~630-char anti-preamble
text (this run), the assembled instructions are 13,221 chars and the full session payload is 25,521.
The remaining weight is the SAFETY section, persona (2,180), Martita profile (1,182), the tool
schemas, and the transcription bias prompt — not dead text. Reaching <5,000 needs a structural
change (e.g. per-intent instruction injection at response.create time, or trimming tool
descriptions), which is real work with regression risk, not a deletion. Reported honestly; the
ratchet enforces no-regrowth toward the target.

## A5 · The "oracle problem" (Part 3) is real and was the Gilad root cause — now fixed structurally
Verified: `whoIs` computed `relationToMartita` from `relationshipOf` only, which returned null for
a spouse-of-a-grandchild (no single Hebrew term), and fell back to `role` → null for Gilad. No test
could catch it because they asserted against the same dataset. FIX: added `grandchild_in_law` +
wired the `describePathBetween` fallback so whoIs is never null for a connected entity; generated
`FAMILY_GROUND_TRUTH.md` (65 people, 0 gaps, 0 not_found pairs) as the independent oracle. This is
the brief's strongest, correct insight.

## A6 · "Green unit tests are not evidence" — the repo proves it
12,769 tests passed beside a product that failed on contact twice. Confirmed: the family tests
passed while Gilad returned null. The deterministic Layer-1 oracle test (relationNeverNull.test)
now closes that specific circular-testing gap; other domains still need oracle-backed checks.

## ADVERSARIAL REVIEWER PASS (inline — what could still go wrong that nothing here catches?)
Attacking the current plan + check set:
1. **grandchild_in_law gender/edge correctness** — the new term assumes X is the spouse of a
   grandchild. If a person is BOTH a grandchild's spouse AND something closer, order matters;
   verified it sits AFTER the blood + child_in_law checks, so a closer tie wins. Pair matrix green.
2. **describePathBetween can be long/awkward as a whoIs answer** — a 3-hop path spoken aloud may be
   verbose for an 80-year-old. Mitigated for the common case by the one-hop term; the path is only
   a fallback for rarer ties. Still: a Layer-3 brevity check on who-is answers is NOT yet in place —
   FLAGGED as an uncovered risk.
3. **The M3 "accept correction, never argue" property is instruction-only** — instructions can fail
   (A2). It is unverified on the instrument and could still argue on device. FLAGGED: needs a Layer-3
   multi-turn correction probe, not just the instruction.
4. **Participant substitution ("פגישה עם אח של מור" instead of Leo)** — NOT fixed this session; it is
   a model-behaviour/title-writing defect, not the resolver. FLAGGED as open (M3 remainder).
5. **Deleting the anti-preamble text with no verified structural replacement** — evidence says the
   text did nothing (disobeyed 100%), so deletion is neutral-to-positive, but the preamble itself is
   still UNFIXED (device work). Do not let the deletion read as "preamble closed."
6. **M2 output-validation layer not built yet** — the language-purity / count / read-back defects are
   still open. Deterministic checks are cheap and should land next; classified checks need a
   false-positive measurement before enabling.
7. **Online device path depends on ONLINE_DEEP_FETCH being set** — real price on the phone requires
   the Preview env flag (now set on Preview only). Production still snippet. FLAGGED.

---

## AUDIT · OVERNIGHT BRIEF (from the v0.259.0 device session) vs the actual code

The brief + its amendments were written from the v0.259.0 device session. The branch HEAD is
already **v0.260.0** (my prior session). Checked against the code:

### B1 · Track 1 (general online loop) is ALREADY BUILT + MEASURED — the brief's core ask is done
FALSE that it is unbuilt. `src/services/online/generalSearch.ts` (v0.260) is the general loop:
SEARCH → FETCH first-wins → cheap-model JUDGE+SYNTHESIZE (no type heuristic) → REFINE once →
honest no_answer. Measured over 63 diverse he/es questions: 87.3% pass, 0 hard fails, 0 source
leaks, latency p95 5237ms/max 5622ms (in the 6s ceiling). The brief's own latency warning was
already handled — a synth-time RESERVE keeps fetch+judge under the ceiling (the first run hit
7335ms, was measured, then fixed). Report: docs/eval/ONLINE_ACCEPTANCE.md.

### B2 · "Do not delete the price path before the replacement wins" — already satisfied by measurement
The brief says keep the price gate until head-to-head proves the loop is at least as good. That
head-to-head WAS run: off-vs-on gave OFF-only=0 (the general loop never loses where the snippet
wins) and ON-only=2 (strictly better); price questions (597₪, milk, Nespresso) pass on the general
loop. So the deletion of isPriceQuery/priceNearProduct was evidence-based, not a blind guess. The
amendment's own note ("price 505₪ clean, cinema returned the meta description") is exactly the
per-topic-patchwork failure the general loop removes — cinema now goes through the same judge.

### B3 · Track 2 flag (ONLINE_DEEP_FETCH) — already moved to code (v0.260), full audit still owed
The dangerous Preview-only env var is gone: `flags.ts` `ONLINE_GENERAL_SEARCH_DEFAULT=true` is a
CODE default that survives a merge; env is now an ops kill-switch only. The FULL flag audit (every
flag: evidence, default, survives-merge) is the remaining Track-2 work — done as ONLINE_FLAG_AUDIT.md.

### B4 · The NEW device P0s are the real remaining work (correctly prioritised over re-doing Track 1)
- **full-name lookup** ("גלעד אבורדי"→not_found): REAL, confirmed in code (the name index holds
  "גלעד" not the full string, and edit-distance is too far). FIXED this session (subsetResolve).
- **misheard→no clarification** ("טוצ'י"→"טורקי"→lecture): REAL. The resolver has phonetic/skeleton
  matching but no "did you mean…?" SUGGEST path, and no session-level "don't repeat a failed lookup".
  Partly deterministic (closest-candidate), partly model/session — scoped honestly, not overclaimed.
- **M1 preambles 5/5**: REAL and matches my prior A2 finding — the preamble is AUDIO-path and does
  NOT reproduce on the text instrument. Deleting the dead instruction text was necessary-not-
  sufficient. The HARD truth: the realtime API streams the tool-calling response's audio as it is
  generated, so by the time the client sees the function_call event the preamble has ALREADY played
  — there is no clean client-side "cancel audio before the tool result" in this architecture (the
  same no-pre-delivery-interception-point finding as M2). A real fix needs either a provider-side
  "silent tool call" affordance or a two-response structure; NOT a blind instruction. Flagged as
  device/architecture work, not claimed fixed. The "exactly one active response" half IS buildable
  (Track A barge-in + the deferred-create logic) and is the tractable part.

### ADVERSARIAL REVIEWER (this track) — what nothing here would catch
1. subsetResolve resolves a UNIQUE given name even if the surname the user gave is WRONG (belongs
   to a different family) — it ignores the surname entirely. Low harm (she meant that person) but it
   would also resolve "גלעד <someone-else's-surname>" to Gilad. Acceptable per the P0, noted.
2. A given name shared by a living AND a deceased person → subsetResolve returns them as ambiguous;
   whoIs's subset path only takes the RESOLVED (unique) case, so a shared name still falls to
   not_found in whoIs (contact path does ask). Minor asymmetry, logged.
3. The misheard P0 is only half-addressable in code; the "never lecture about an unrelated word when
   the context is a person" is model behaviour — no deterministic guard catches a model that lectures.
4. M1 preamble remains heard on every tool call until the architecture-level fix — the single most
   frequent thing the owner experiences is still open. Stated plainly, not buried.
