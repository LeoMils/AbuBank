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

## Latest run (v0.123.0)

| dimension | pass | rate |
| --- | --- | --- |
| correctness | 19/19 | 100% |
| warmth | 22/22 | 100% |
| brevity | 22/22 | 100% |
| answered | 22/22 | 100% |
| language | 22/22 | 100% |
| naturalness | 22/22 | 100% |

_Scored turns (deterministic app replies): 22 · model-dependent (LLM-routed, not
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

**Real Leo device flows (added v0.123.0 — each grounded in `LEO_DEVICE_FAILURES_REPRO.json`
+ `deviceFailuresTriage.test.ts`):**
- `he-cal-midnight` — "פגישה עם אופיר מחר בחצות בקפה אילנה" → person + place + 00:00
  extracted; the title is not the whole sentence.
- `he-fam-between` / `es-fam-between` — relation-BETWEEN two family members in Hebrew AND
  Rioplatense; the Spanish reply carries no Hebrew (language discipline).
- `he-relation-for` — "מי גלעד עבור רפי" (in-law edge resolves deterministically).
- `he-rambling-create` — the **P2 rambling-story create**: the meeting is buried in a
  narrative; the confirm resolves the relation-phrase person (גלעד), keeps the real place,
  and no longer restates the subject twice (see the bug below) so brevity holds.

## Bug this scorecard caught on its first run (fixed in v0.121.0)

**Language discipline — Spanish cancel replied in Hebrew.** A Rioplatense "cancelalo" on a
saved event deleted correctly but confirmed in Hebrew ("מחקתי את פגישה עם Gabi…"), because
`detectLang("cancelalo")` is conservative (no accent/ES-marker word → 'he') and
`deleteReasoner` emitted a Hebrew confirmation from the event's Hebrew title. Fixed:
`deleteReasoner` self-detects a Rioplatense delete command and confirms in Spanish
("Listo, cancelé la reunión con Gabi a las 15:00."), using `personName`. This is exactly the
class of gap the parity judge exists to surface: the deterministic engine did the right ACTION
but violated the language dimension.

## Bug this scorecard caught (fixed in v0.123.0)

**Brevity — the rambling-story confirm restated the subject twice.** Adding the real Leo
`create-rambling-story` flow reded `brevity`: "…כדי לדבר על הטיול המשפחתי" extracted BOTH a
subject (`טיול המשפחתי`) and notes (`לדבר על הטיול המשפחתי`), and `shapeCreateConfirm`
rendered each independently → "בנושא טיול המשפחתי. (לדבר על הטיול המשפחתי)." — one subject,
stated twice, blowing the sentence budget. **General fix:** a subject/notes redundancy guard
(`coreWords` strips the definite article + purpose/function words; `saysTheSame` checks
content-word containment) drops the notes parenthetical when it merely restates the
already-shown subject; a genuinely distinct note is kept (regression test guards against
over-suppression). Same class as the v0.121.0 catch: the engine did the right ACTION
(resolved גלעד, kept the place) but violated a quality dimension. Regression test written
FIRST in `responseShaper.test.ts`, reproducing the exact device string.

## Live cross-check judge (ChatGPT-class parity) — `src/eval/parityLiveJudge.ts`

The pluggable seam is now IMPLEMENTED as a **cross-check** panel (the user's choice): the
reference reply is taken from BOTH a Claude model (`claude-opus-4-8`) and an OpenAI (GPT)
model under the same warm-elderly-companion persona brief, and each AbuAI reply is scored by
a judge panel. Aggregation: **AND across judges** (a dimension passes only if every judge
agrees AbuAI matched the reference) then **OR across references** (compare against the
stronger of the two references). Divergence = a flagged parity gap.

- No new dependencies — raw `fetch` (adding an SDK would touch `package.json`, a
  human-approval gate here). Anthropic calls follow the claude-api contract
  (`claude-opus-4-8`, `output_config.effort: 'high'`, structured-output judge schema).
- **Runs OUT-OF-BAND, not in the unit suite** — it needs `ANTHROPIC_API_KEY` +
  `OPENAI_API_KEY`, which this env does not have. A keyed run is PREVIEW/PRODUCTION-class
  evidence. The wiring (request shapes) and the cross-check aggregation are proven
  deterministically with mocked `fetch` in `parityLiveJudge.test.ts` (CODE) — 7/7 green.

**To run the live cross-check (out-of-band, with keys):**

```ts
import { runParityScorecard } from './parityScorecard'
import { makeClaudeReference, makeOpenAIReference, makeClaudeJudge, makeOpenAIJudge,
  makeCrossCheckReference, makeCrossCheckSeamJudge } from './parityLiveJudge'

const claude = { apiKey: process.env.ANTHROPIC_API_KEY!, model: 'claude-opus-4-8' }
const openai = { apiKey: process.env.OPENAI_API_KEY!, model: '<a current GPT model>' }
const reference = makeCrossCheckReference(
  makeClaudeReference(claude, fetch), makeOpenAIReference(openai, fetch))
const judge = makeCrossCheckSeamJudge([
  makeClaudeJudge(claude, fetch), makeOpenAIJudge(openai, fetch)])
const res = await runParityScorecard(buildSessions(), { reference, judge })
// Record res here as a separate, higher-evidence-class section.
```

## How to extend

- Add real turns (especially from `src/eval/*iphone*`, `deviceFailuresTriage`,
  `leoRetestAcceptance`, `realDeviceTranscriptRegression`) to `buildSessions()`; each new turn
  that fails names the next parity gap.
- To run **live-model parity**, pass `{ reference, judge }` to `runParityScorecard` with real
  model callers (out-of-band, not in the unit suite) and record the run here as a separate,
  higher evidence-class section.
