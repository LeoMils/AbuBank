# AbuAI Parity Scorecard

**What this is:** a standing, repeatable measurement of AbuAI's ACTUAL app-path reply on
the 6 parity dimensions from the MASTER mandate — **correctness · warmth · brevity ·
answered-what-was-asked · language discipline · naturalness** — for a curated, grounded set
of real-capability turns (Hebrew + Rioplatense Spanish), run through the SAME app entry the
generative marathon uses (index.tsx-faithful preprocessing + ExecutiveCognitiveController,
mocked llm/online).

**Source:** `src/eval/parityScorecard.ts` (harness) · `src/eval/parityScorecard.test.ts`
(standing suite, per-dimension floors). Oracles are computed from the SAME engines the
runtime uses (family graph + fixed clock) so they cannot drift.

## Evidence class & honest reach

- **CODE** (deterministic). This is the **deterministic half** of the parity judge. It fully
  scores turns whose app reply is runtime-composed (calendar CRUD + referability, family-who,
  date arithmetic, memory) and REUSES the existing judges — it does NOT build a parallel one:
  - `conversationQualityJudge.judgeTurn` — forced-menu / childish / robotic / markdown /
    doubled-word / live-fact-without-tool / empty.
  - `judgeRunner.judgeResponse` — emotional / naturalness (0–100).
  plus per-dimension oracle checks (correctness/answered via the engines; brevity budget per
  intent; language = reply-lang matches turn-lang).
- **NOT live-model parity.** The "identical to a ChatGPT-class model" LIVE comparison (a real
  reference reply + a judge model) is a **pluggable seam** — `ParityOptions.reference` /
  `.judge` in `parityScorecard.ts`. This environment mocks the LLM and has no live
  ChatGPT-class tool, so the seam is left unset here. Wiring a live provider (key + provider
  decision) upgrades this to PREVIEW/PRODUCTION-class parity; see
  `docs/eval/MARATHON_CYCLES_39_40_CHECKPOINT.md`.
- **Model-dependent turns** (family/emotional primary that route to the LLM) return a stub
  here and are reported as *model-dependent, not deterministically scored* — never silently
  passed.

## Latest run (v0.121.0)

| dimension | pass | rate |
| --- | --- | --- |
| correctness | 14/14 | 100% |
| warmth | 17/17 | 100% |
| brevity | 17/17 | 100% |
| answered | 17/17 | 100% |
| language | 17/17 | 100% |
| naturalness | 17/17 | 100% |

_Scored turns (deterministic app replies): 17 · model-dependent (LLM-routed, not
deterministically scored): 1._

**Turn set (grounded in proven capabilities):**
- `he-calendar` — create → save → referable "where do I meet him?" → "cancel it".
- `he-knowledge` — "מי אמא של X" (unique-mother oracle) + "בעוד 5 ימים איזה יום".
- `he-memory` — store a preference → recall it.
- `he-relation-ordinal` — two creates → "תבטלי את הפגישה הראשונה" (ordinal-first cancel).
- `es-calendar` — Rioplatense create → "dale, agendalo" → "cancelalo".
- `es-probes` — "recordá que me gusta el vino tinto" + "qué te acordás de mí": ES memory
  store AND recall both answer **deterministically in Spanish** ("Listo, me acuerdo: …" /
  "Me acuerdo de esto sobre vos: …") — Spanish memory has parity, NOT a gap. "¿quién es
  Gabi?" is **model-dependent** (routes to the LLM) because Gabi is not a known family
  member (`findNode` → null); that is CORRECT — AbuAI must not fabricate an identity for an
  unknown name — and the scorecard reports it honestly rather than scoring a guess.

## Bug this scorecard caught on its first run (fixed in v0.121.0)

**Language discipline — Spanish cancel replied in Hebrew.** A Rioplatense "cancelalo" on a
saved event deleted correctly but confirmed in Hebrew ("מחקתי את פגישה עם Gabi…"), because
`detectLang("cancelalo")` is conservative (no accent/ES-marker word → 'he') and
`deleteReasoner` emitted a Hebrew confirmation from the event's Hebrew title. Fixed:
`deleteReasoner` self-detects a Rioplatense delete command and confirms in Spanish
("Listo, cancelé la reunión con Gabi a las 15:00."), using `personName`. This is exactly the
class of gap the parity judge exists to surface: the deterministic engine did the right ACTION
but violated the language dimension.

## How to extend

- Add real turns (especially from `src/eval/*iphone*`, `deviceFailuresTriage`,
  `leoRetestAcceptance`, `realDeviceTranscriptRegression`) to `buildSessions()`; each new turn
  that fails names the next parity gap.
- To run **live-model parity**, pass `{ reference, judge }` to `runParityScorecard` with real
  model callers (out-of-band, not in the unit suite) and record the run here as a separate,
  higher evidence-class section.
