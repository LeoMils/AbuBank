# IMPACT_SCOREBOARD

The user-facing impact of every cycle. BENCHMARK_SCORE = % of real user-moments
that behave correctly (`npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts`).
A cycle is only "done" when this table has a new row.

| Version | BENCHMARK_SCORE | Δ | Moments | Change shipped | Evidence |
|---|---|---|---|---|---|
| 0.8.3 (baseline) | 100.0% | — | 38/38 | benchmark established (calendar 15, online 6, conv-os 4, companion 7, failure-copy 4, routing 2) | benchmark run |
| 0.8.5 | 100.0% | +12 moments | 50/50 | **Spanish calendar create** — was 0% (isCreateIntent=false on "agendá una reunión con Gabi mañana a las tres"); now full es create (intent/who/date/time/AM-PM/confirm). Added 12 `spanish` benchmark moments. | benchmark run + suite 5982 |
| 0.8.6 | 100.0% | +4 moments | 54/54 | **Spanish location** — was 0% ("en el café Morocco" → cancel/null); now extracted inline + merged into a pending event ("en casa"/"en la clínica"). | benchmark run + suite 5982 |
| 0.8.7 | NORTH_STAR 99.5→**100%** | 588 eval cases | — | **Eval Engine** built (10 capabilities × 8 dimensions, real pipeline, deterministic + judge-marked-uncertain, 4 reports, regression detection). It FOUND a real bug: "sí, agendalo" not confirmed → fixed (es confirm). | eval run docs/eval/ + suite 5984 |
| 0.8.8 | NORTH_STAR **100%** · JUDGE **100/100** | 1095 cases + 69 judged | — | **Judge pass + coverage**. Built a SEPARATE rule judge (judgeRunner.ts, NOT AbuAI) on deterministic prose. It FOUND + fixed: Spanish emotional fallback replied in Hebrew (→ es companion lines); online gaps "מי שיחק"/"מתי שוקעת השמש". Coverage expanded to all minimums (family 165/emotional 147/continuity 111/hebrew 180/online 87…). | docs/eval/ + judge-results.json + suite 5984 |
| 0.74.0 | 100.0% (floor held) | family conversation: possessive spouse queries grounded (was punting to LLM) | — | **CONVERSATION_GAP_MAP + G1 fix** (parity-program cycle 7). Built `docs/CONVERSATION_GAP_MAP.md` by driving the REAL controller over a broad Hebrew/Spanish/mixed corpus — key finding: the controller is the sole runtime path but its grounded family coverage is weaker than the deprecated `tryGroundedAnswer`, so grounded-answerable turns punt to the LLM. Fixed the top machine-provable gap (G1): the POSSESSIVE spouse form "מי בעלה של אופיר" / "מי אשתו של עילי" was punted (reasoner + classifier matched only "הבעל של"/"האישה של"); now grounded → גלעד / ירדן. | RED-first regression spouseQueryForms 5/5 (direct + through-controller) + family/gender non-regression 56 + full suite 10804 pass/2 todo + tsc + build. G2 (Spanish family) / G3 (referent-carry) queued. |
| 0.73.0 | 100.0% (floor held) | Spanish create completes end-to-end (ambiguous hour + cancel + clean title) | — | **Spanish create completes** (parity-program cycle 6). (1) A single-utterance es create with an AM/PM-ambiguous bare hour ("anotá una cita el viernes a las diez") used to ask "¿A qué hora?" then dead-end on "dale"; now resolves to the default reading → confirm → saves once at 10:00 (es analog of 0.68.0). (2) Spanish "no"/cancelá/dejá/olvidate now cancels in Spanish instead of punting to the LLM; "no, a las cuatro" stays a correction, not a cancel. (3) Person-less es title is the schedulable noun with correct gender ("una cita"/"un turno"). | RED-first regression spanishCreateCompletion 8/8 (stash-verified red→green) + spanish/fragmented non-regression + full suite 10799 pass/2 todo + tsc + build. Device VOICE gap → OP-002. |
| 0.72.0 | 100.0% (floor held) | relation-between resolves Martita by her everyday name | — | **relation-between-Martita alias** (parity-program cycle 5). `מה הקשר בין אופיר למרתה` answered "לא יודעת" because "מרתה" (Marta — the everyday spelling of canonical "מרטיטה") was not a recognized alias, so `findNode("מרתה")` was null and the relation-between handler bailed. First divergence was NAME RESOLUTION, not the handler (`מרטיטה`/`אבו` already worked). Added "מרתה" to Martita's aliases in `knowledge/family_graph.json` (runtime) + `knowledge/family_data.json` (source of truth) → `מה הקשר בין אופיר למרתה`→"מרטיטה הסבתא של אופיר (דרך מור)". Feminine forms (הסבתא/הנכדה) + ex-spouse directionality unchanged. | RED-first regression relationBetweenMartita 4/4 + ofir/exSpouse 23 + validate:family + validate:knowledge + full suite 10792 pass/2 todo + tsc + build |
| 0.71.0 | 100.0% (floor held) | family ex-spouse now answered deterministically, both directions | — | **Family ex-spouse directionality** (parity-program cycle 4; release-gate for family correctness). `מי הגרוש של מור` fell through to a profile-blurb lookup ("מור, הבת שלך…") and `answerFamilyRelation` returned null (no ex-spouse REL rule) → LLM guess; the reverse `רפי הוא הגרוש של מי` only "passed" by coincidence (Rafi's blurb mentions מור). Added an `ex_spouse` REL rule set (forward `מי הגרוש/הגרושה של X`, from-whom `ממי X גרושה`, reverse `X (הוא) הגרוש של מי`) over the SYMMETRIC `exSpousesHe` edge → all resolve to `exSpouseOf(the named person)`; rendered `הגרוש/ה של X`. `מי הגרוש של מור`→רפי, `ממי מור גרושה`→רפי, `רפי הוא הגרוש של מי`→מור. Partner + Ofir feminine forms unchanged. | RED-first regression exSpouseDirectionality 7/7 + genderMatrix/rc3/ofirGenderRegression 56 + full suite 10788 pass/2 todo + tsc + build. Also fixed pre-existing drift: copyTurnsButton version pin was stale at 0.67.0 → now tracks the single source. |
| 0.70.0 | 100.0% (floor held) | Spanish create now first-class es end-to-end | — | **Spanish create stays Spanish** (§20.2). After 0.69.0 the es create SAVED but every AbuAI turn was Hebrew (clarify "באיזו שעה?", confirm "…נכון?", save "קבוע —"). Threaded the create's language (remembered on the draft for cross-turn continuity, since "a las cuatro" detects as he) through clarify/confirm/save/cancel + rendered the Hebrew "פגישה עם X" title as "una reunión con X"; `composeCreate` bypasses Hebrew persona shaping for es. Hebrew creates unchanged. | gold replay spanishCreateLocale 5/5 + AbuAI/AbuCalendar/eval 9923 pass + tsc + build |
| 0.69.0 | 100.0% (floor held) | mandatory §20.2 scenario 0→working | — | **Spanish transcript locale integrity** (parity-program cycle 2). THE mandatory Spanish scenario "Agendá una reunión con Gabi mañana a las tres" was broken end-to-end in the runtime: the Hebrew STT-recovery dedup rule (Hebrew-only word boundary) matched a false "a a" duplicate across "mañana"+"a" and dropped the preposition → "mañana las tres" → ES clock regex failed → asked "באיזו שעה?" in Hebrew → "dale" dead-ended, nothing created. Fixed the dedup boundary to be script-agnostic (\p{L}\p{M}); scenario now creates once at 15:00 and "dale" saves. | gold replay 5/5 + AbuAI/AbuCalendar/eval 9918 pass + tsc + build |
| 0.68.0 | 100.0% (floor held) | +2 parity moments (gold replay) | — | **Fragment ambiguous-hour PARITY** (parity-program cycle). Fragment "drip" create with an AM/PM-ambiguous bare hour ("תקבעי"→"עם מור"→"מחר בשמונה"→"כן") used to stay ambiguous forever and dead-end on "כן" (nothing saved); now the fragment slot-fill resolves it to the SAME default the single-utterance smart layer uses → confirm → "כן" saves exactly once. Fragment create === single-utterance create. Also: bare period correction ("לא בערב") at confirm now flips AM→PM (never-lose-a-correction). | gold replay 6/6 + AbuAI 4302 + AbuCalendar/eval 5611 + tsc + build |

## Cycle log
- **0.8.5 (ROI cycle 1)** — NORTH_STAR → benchmark 100% (38) → probed least-covered
  surface (Spanish, her 2nd language) → found Spanish calendar create 0% → implemented
  es intent + person ("con X") + dates (hoy/mañana/pasado mañana/el viernes/la semana
  que viene) + times (a las tres / y media / de la tarde·noche·mañana) → re-benchmark
  100% (50, spanish 12/12). Regression caught + fixed: noun "Agenda de mañana" (a READ)
  must not match the verb "agendá" (now requires a schedulable object).
  NEXT: Spanish reminder ("recordame…") and Spanish location merge ("en el café").

## How to use
1. Before a change: run the benchmark, note the score + failing moments.
2. Pick the change that fixes the most user-impactful failing moment (or removes a
   P0 / unblocks Production) for the least risk.
3. After the change: re-run the benchmark + `npm run check`. Add a row here with
   the before→after delta and what moved.
4. If the score went UP, raise the FLOOR constant in `benchmarkConversations.test.ts`
   so it can never regress.

## Notes
- Score is at the 100% ceiling because prior war-room cycles already fixed these
  moments. To keep raising ROI, ADD new failing moments to `SCENARIOS` that
  represent real gaps (then fix them) — the benchmark grows with the product.
- Adding a scenario that currently FAILS is the honest way to expose the next
  highest-ROI work: it drops the score, names the moment, and the fix raises it back.
