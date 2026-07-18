# MASTER Checkpoint — Cycles 39–40 (Generative Marathon widening) + next: Parity Judge

**Branch:** `rc5/cognitive-architecture-and-acceptance`
**HEAD after this segment:** `docs(war-room): log Cycles 39-40` (on top of `feat …Cycle 40 (0.120.0)`)
**Version:** `0.120.0-marathon-ordinal` (src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync)

## What shipped this segment (all gates green each cycle)

Priority (1) — WIDEN the generative marathon — substantially advanced.
`src/screens/AbuAI/generativeMarathon.test.ts` now runs **1200 sessions × 10 scenario
classes** through the REAL app entry (index.tsx-faithful preprocessing +
ExecutiveCognitiveController, mocked llm/online), CLEAN.

Scenario classes: familyWho · calendar CRUD · memory store/recall/forget · date
arithmetic · **relation-phrase create** · **"the last one" cancel chain** · **mid-flow
person correction** · **Spanish (Rioplatense) calendar** · **cross-language cancel** ·
**"the first one" cancel chain**.

Real general mechanisms fixed (each = a class the wide batch exposed):
1. **ES referable delete** — "cancelalo/borrá/eliminala" on a SAVED event dead-ended to
   the LLM (Hebrew-only gate). Added `REFERENTIAL_DELETE_ES_RE` (calendarMutationReasoner.ts).
2. **Focus-property precision** — "איפה אני פוגשת אותו?" read the OLDEST same-person event;
   now the most-recently-created match (cognitiveRuntime.ts `answerCalendarProperty`).
3. **Person-name truncation** — extractPerson's bare `ב/ל/על` prefix-stop truncated any
   name starting with ל/ב (לאו, לאה, לירון) and the genitive target after "של". Split
   hard-stops from the prefix-stop; exempt first person word + post-"של" (eventExtractor.ts).
4. **Ordinal delete** — "תבטלי את הפגישה הראשונה" deleted the FOCUSED/last event; added
   `ORDINAL_FIRST_RE` → chronologically-earliest (calendarMutationReasoner.ts). "last/האחרונה"
   left on its working focus path (no regression).

Cross-language cancel (He↔Es) was already CLEAN — the referable gate is language-agnostic
once a calendar focus is set. Two of the original 910 breaks were marathon oracle bugs
(store-accumulation), now store-aware.

Evidence (CODE at app-entry level): generativeMarathon 1200/1200 clean; full suite
**11017 pass / 2 todo**; typecheck + build clean. Voice/Realtime untouched.

## Next highest-ROI: Priority (2) PARITY JUDGE — design constraints discovered

The mandate wants a judge that, for sampled turns, gets a **ChatGPT-class reference reply**
(same context + warm-elderly-companion He/Es persona) and has a **judge model** score
AbuAI's actual app-path reply vs the reference on: correctness, warmth, brevity,
answered-what-was-asked, language discipline, naturalness — persisted as a standing suite
+ scorecard.

**Blocking decision (needs a human choice on model access):** this test environment mocks
the LLM and has **no live ChatGPT-class tool**, so a *live-model* reference/judge cannot run
deterministically in `vitest`. Options:
- (a) **Live seam, run out-of-band**: build the harness with a pluggable `reference(turn)` +
  `judge(app, ref)` interface; wire a real provider (needs a key + provider decision:
  OpenAI vs Anthropic Claude as the reference) and run it as a PREVIEW/PRODUCTION-class
  job, NOT in the unit suite. Highest fidelity to "identical to ChatGPT."
- (b) **Deterministic half now**: REUSE the existing deterministic judges — do NOT rebuild:
  - `src/eval/conversationQualityJudge.ts` `judgeTurn()` (0–5: forced-menu, childish,
    robotic, markdown, doubled-word, live-fact-without-tool, empty).
  - `src/eval/judgeRunner.ts` (0–100 emotional/naturalness; banned-phrase + fabricated-life).
  Compose these + NEW per-dimension checks (brevity budget per intent, language-discipline
  = reply lang matches turn lang, answered-what-asked = intent-appropriate oracle content,
  correctness = family/date engine oracles) into a **parity scorecard** over a curated turn
  set. Honest label: *deterministic quality parity*, NOT live-model parity.

**Recommended:** ship (b) as the runnable standing suite (reuses existing judges, grounds on
real turns), and structure it with the (a) seam documented so a keyed live run drops in later.
Ground the turn set in REAL flows — see `src/eval/*iphone*`, `deviceFailuresTriage.test.ts`,
`leoRetestAcceptance.test.ts`, `realDeviceTranscriptRegression.test.ts` — plus a marathon
turn sample. Avoid creating a parallel judge; extend the existing eval judges.

Priorities (3) P2 LLM semantic calendar extraction and (4) BEHAVIOR_SPEC also depend on
live-LLM/preview proof — same model-access decision gates their end-to-end evidence.

## Segment-4 update — Cycle 43 done (grow parity set w/ real Leo flows + rambling dedup fix)

HEAD now `feat …Cycle 43 (0.123.0-parity-rambling-dedup)`. Took the "grow the parity turn
set with real device-failure flows" branch of the continuation. **Diagnosis-first:** ran 5
grounded Leo flows (`docs/eval/LEO_DEVICE_FAILURES_REPRO.json` + `deviceFailuresTriage.test.ts`)
through the SAME parity harness before touching anything. Four were clean
(midnight+person+place extraction, He/Es relation-BETWEEN, relation-FOR); **one red** — the P2
`create-rambling-story` confirm restated the subject TWICE (`בנושא טיול המשפחתי` +
redundant `(לדבר על הטיול המשפחתי)`), blowing brevity.

- **General fix** (`shapeCreateConfirm`, `responseShaper.ts`): a subject/notes redundancy
  guard — `coreWords` (strip definite article + purpose/function words) + `saysTheSame`
  (content-word containment) — drops the notes parenthetical when it merely restates the
  already-shown subject; a genuinely distinct note is kept (guarded against over-suppression).
- **Regression test FIRST** (`responseShaper.test.ts`, red→green, exact device string) +
  a no-over-suppression companion test.
- Promoted all 5 flows into the standing scorecard: **6/6 dimensions @100% over 22 scored
  turns** (was 17), 1 correctly LLM-routed. Calendar brevity budget aligned to the product
  rule (root CLAUDE.md: "voice responses 2-4 sentences max"; the 220-char cap stays as the
  anti-ramble guard) — correcting an over-strict oracle, not hiding a bug.

Evidence (CODE): responseShaper 61/61; parityScorecard 22/22 @100%; full suite
**11027 pass / 2 todo**; typecheck + build clean. Voice/Realtime untouched. Live cross-check
seam still unkeyed (out-of-band). Builds on 0.122.0.

**Continuation prompt (paste to resume):**

> Continue the MASTER MANDATE on rc5 from HEAD (0.123.0-parity-rambling-dedup). Verify git
> state first. The deterministic parity scorecard is now 6/6 @100% over 22 turns incl. 5 real
> Leo device flows; the rambling-story subject-duplication is fixed generally in
> shapeCreateConfirm. Pick the next highest-ROI in-sandbox step: EITHER keep mining real Leo
> flows (src/eval/deviceFailuresTriage, leoRetestAcceptance, realDeviceTranscriptRegression,
> LEO_DEVICE_FAILURES_REPRO.json) into the parity set — each new red dimension names a real
> gap to fix with a GENERAL mechanism, regression test FIRST — OR build (3) P2 LLM semantic
> calendar extraction for the rambling-story class behind the EXISTING controller (reuse
> engines, no parallel path), with the live-LLM end-to-end proof deferred to a keyed
> preview run. Reuse existing judges/engines; never build a parallel judge. Increment version
> + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (no apostrophes in
> buildLabel — the health drift regex breaks on them); run typecheck + full vitest + build;
> commit. Label CODE vs live-model honestly; the live cross-check seam + P2 end-to-end remain
> out-of-band until provider keys / a deployed preview exist. Do not claim preview/device
> without proof.

## Segment-3 update — Cycle 42 done (live cross-check parity judge)

HEAD now `feat …Cycle 42 (0.122.0-parity-live-crosscheck)`. Implemented the pluggable LIVE
reference/judge seam as a **cross-check panel** (user choice): reference from BOTH
`claude-opus-4-8` and an OpenAI GPT model under one persona brief; judge panel with **AND
across judges** then **OR across references**. `src/eval/parityLiveJudge.ts` (raw fetch — no
package.json change; Anthropic per the claude-api contract) + `makeCrossCheckReference` /
`makeCrossCheckSeamJudge` fit the `ParityOptions` seam exactly, so a keyed run is
`runParityScorecard(sessions, { reference, judge })`. The **KEYED run is OUT-OF-BAND** (needs
`ANTHROPIC_API_KEY` + `OPENAI_API_KEY`; PREVIEW/PRODUCTION evidence); wiring + aggregation are
proven with mocked fetch — `parityLiveJudge.test.ts` 7/7 (CODE). Runner snippet is in
`docs/eval/PARITY_SCORECARD.md` → *Live cross-check judge*.

**Open for the next segment:** (a) execute the KEYED live cross-check once keys are provided
and record the PREVIEW-class scorecard; (b) Priority (3) P2 LLM semantic calendar extraction
for the rambling-story class, proven on the deployed preview; (c) Priority (4)
`docs/BEHAVIOR_SPEC.md` informed by the parity results. All three need an external resource
(provider keys or the deployed preview) the sandbox lacks.

## Segment-2 update — Cycle 41 done (parity scorecard shipped)

HEAD now `docs(parity): correct model-dependent finding` on top of
`feat …Cycle 41 (0.121.0-parity-scorecard)`. Delivered the **deterministic half of the
parity judge** (option b above):
- `src/eval/parityScorecard.ts` + `parityScorecard.test.ts` — a standing suite scoring the
  ACTUAL app-path reply on all 6 dimensions over a curated He+Es turn set, REUSING
  `judgeTurn` + `judgeResponse` (no parallel judge), with a pluggable live `reference`/`judge`
  seam. `docs/eval/PARITY_SCORECARD.md` holds the scorecard (currently **6/6 dimensions at
  100%, 17 scored turns, 1 model-dependent**).
- It caught a REAL bug on first run: a Rioplatense "cancelalo" deleted correctly but
  confirmed in HEBREW → fixed `deleteReasoner` to confirm in Spanish via `personName`.
- Verified (evidence over assumption): ES memory store+recall have Spanish parity; the one
  model-dependent turn ("¿quién es Gabi?") is correctly LLM-routed because Gabi is not a
  known family member (`findNode` → null) — no fabrication.

Remaining for Priority (2): the **LIVE** ChatGPT-class reference+judge (the seam) — still
gated on the model-access decision below. Priorities (3) P2 LLM semantic calendar extraction
and (4) BEHAVIOR_SPEC are next and also want live-LLM/preview proof.

## Continuation prompt (paste to resume)

> Continue the MASTER MANDATE on rc5 from HEAD (0.121.0-parity-scorecard). Verify git state
> first. The deterministic parity scorecard is shipped (src/eval/parityScorecard.*,
> docs/eval/PARITY_SCORECARD.md, 6/6 @ 100%). Next, EITHER (2b) grow the parity turn set with
> more REAL Leo flows mined from src/eval/*iphone*, deviceFailuresTriage, leoRetestAcceptance,
> realDeviceTranscriptRegression — each new turn that reds a dimension names a real gap to fix
> via a general mechanism — OR (2a) wire the LIVE reference/judge seam (needs a provider +
> key decision: OpenAI vs Claude as the ChatGPT-class reference; run out-of-band, NOT in the
> unit suite) OR (3) build P2 LLM semantic calendar extraction for the rambling-story class,
> proven on the deployed preview. Reuse existing judges/engines; never build a parallel judge.
> Increment version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync (avoid
> apostrophes in the buildLabel — the health drift regex breaks on them); run typecheck + full
> vitest + build; commit. Evidence discipline: verify, never assume; label CODE vs live-model.

## Superseded continuation prompt (segment-1, kept for history)

> Continue the MASTER MANDATE on rc5 from HEAD (0.120.0-marathon-ordinal). Verify git state
> first. Build Priority (2) the PARITY JUDGE, option (b) first: a deterministic parity
> scorecard that REUSES `conversationQualityJudge.judgeTurn` and `judgeRunner` (do NOT build a
> parallel judge). Curate a turn set from the REAL device-failure evals (`src/eval/*iphone*`,
> `deviceFailuresTriage`, `leoRetestAcceptance`, `realDeviceTranscriptRegression`) + a
> sample of generativeMarathon turns; run each through the SAME app entry the marathon uses;
> score each on the 6 mandate dimensions (correctness via family/date oracles, warmth,
> brevity per-intent, answered-what-asked, language discipline = reply-lang matches turn-lang,
> naturalness). Assert per-dimension pass-rate floors as a standing suite and write a scorecard
> to docs/eval/PARITY_SCORECARD.md. Structure a pluggable `reference()`/`judge()` seam for a
> future LIVE ChatGPT-class run (do NOT fake it; label the deterministic run honestly).
> Increment version + keep src/version.ts ⇄ api/health.ts ⇄ src/version.test.ts in sync; run
> typecheck + full vitest + build; commit. Then propose the live-reference provider decision.
