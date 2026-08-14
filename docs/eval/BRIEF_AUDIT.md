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
