# Decisions log — convergence v3 (audit trail; replaces asking)

Rule (from the owner, permanent): ambiguity resolves by rule, never by asking.
- Two plausible readings → choose the stricter, more critical (defect-hunter) one.
- Coin-flip class → record BOTH, first is primary, move on.
- Cannot decide → mark LOW_CONFIDENCE, exclude from calibration scoring, proceed.
There is no case where I stop and wait. Every such call is logged below.

## D-CAL-01 · Removed L197 from the calibration set
L197 ("קלוד תדאג לעשות מנגנון QA הרבה יותר רציני") directs the DEV about QA quality;
it is not a defect of Abu's conversational behavior. A non-defect in the set teaches
the judge to score noise. REMOVED entirely (kept in the trace, not in calibration).
Same reasoning retired L195 to LOW_CONFIDENCE (garbled meta/QA request, not a
response judgment).

## D-CAL-02 · Split the "other" bucket into concrete classes
28% of entries in one bucket hid defects of different severity. New classes:
INTERRUPTION (L101, BLOCKER-class audio), TASK_FAILURE (L162), LANGUAGE_IGNORED
(L166), UNHELPFUL (L25, L138), ENTITY_BEHAVIOR (L66, L68). No entry was invented to
fill a class; each maps to explicit owner words.

## D-CAL-03 · De-duplicate by INCIDENT for scoring weight
Repeated pushback on ONE failure is ONE calibration weight (all entries preserved as
evidence). Incidents where the owner repeated himself, collapsed to one weight:
- INC-04 Adi/Leo relation (L34 correction → L36/L38/L40 rebukes of the insistence).
  STRICTER READING (rule): the incident's PRIMARY class = `arguing back` (a companion
  insisting against the owner about his OWN family is the more severe defect than the
  initial slip), SECONDARY = `factual error`.
- INC-05 relation over-explaining (L45 gilad/adi, L51 aylon/ari — same "just the
  answer, no derivation" complaint) → one weight, `over-explaining`.
- INC-06 calendar title (L66, L68 — same participant/title complaint) → one weight,
  `entity_behavior`.
- INC-07 reminders (L84 request, L88/L92/L97 "it must exist") → one weight,
  `capability refusal`.
- INC-09 persistent memory (L107/L112 Kacho death, L126 Lidia's sons — same "you
  cannot update" failure surfaced by two facts) → one weight, `capability refusal`.
- INC-12 price online (L136, L138 — same price answer) → one weight, `source-citing`.

## D-CAL-04 · Coin-flip classes recorded (both), stricter primary
- INC-03 (L30): `over-explaining` PRIMARY vs `source-citing`. Coin-flip → both; primary
  over-explaining ("don't share your problems") since it is the broader instruction.
- INC-12 (L136): `source-citing` PRIMARY vs `unhelpful`. Stricter/defect-hunter reading
  = source-citing (concrete, matches "מקור: Wisebuy" in the response) + unhelpful 2nd.
- INC-10 (L142): `factual error` (retention). Root is the same missing-memory as
  INC-09, but the OWNER'S complaint here is a wrong asserted fact ("I told you he
  died"), a different defect surface → kept as its own incident/class.

## D-CAL-05 · LOW_CONFIDENCE (excluded from calibration scoring, kept as evidence)
L18 (affirmation, not a defect judgment), L55 ("זה לא מעבודי" garbled STT), L103 (mild
redirect), L168 ("קצת הפסקת דיחה" garbled), L195 (garbled QA meta). 5 entries.

## D-CAL-06 · Voice-path criteria cannot be calibrated from this trace
The trace is TEXT evidence. `preamble` appears once (L193) and `interruption` once
(L101), but both are AUDIO-path defects (the reproduction gate already showed the
preamble does not appear off-device). Per the owner's rule 3: these are weighted as
UNDER-REPRESENTED, NOT low-priority. The judge's agreement on them is NOT trustworthy
from text; they are marked "cannot calibrate from trace — device-only" and must keep
their fix-queue priority regardless of their low count here.

## D-CAL-07 · Judge calibrated to 93.8% via 3 principled rubric fixes
Agreement (human_primary ∈ judge.classes) over 16 text-scorable incidents:
81.3% → 87.5% → 93.8% (15/16). Fixes (each encodes the owner's stated standard):
1. Added the `entity_behavior` DEFINITION to the rubric text (the token was in the
   taxonomy but undefined → INC-06 misclassified as task_failure).
2. Sharpened `over_explaining`: for a family relation, ANY derivation/intermediate
   chain (not just the one relation sentence) is over_explaining (INC-05); for a
   prepared message, restating the content/change the user already sees on screen is
   over_explaining (INC-13).
3. Narrowed `task_failure`: PREPARING a WhatsApp/calendar draft for the user to
   confirm is CORRECT, never task_failure (it wrongly flagged INC-06/INC-13).
RESIDUAL (proven, not gamed): INC-03 stays a disagreement. The bus response carries
3–4 overlapping defects; the judge flags it defective as [capability_refusal,
unhelpful] (both defensible) but not [over_explaining, source_citing]. The judge
DETECTS the defect; only the class label differs. Forcing agreement here would
require overfitting the rubric to one multi-defect turn — rejected. 93.8% ≥ 90% → proceed.

## D-CAL-08 · The human trace is PERMANENT HOLDOUT (registered)
`docs/eval/human-trace/abu-live-trace.txt` + its derived `calibration-set.*` are the
only human ground truth. From here: NO fixing agent reads them; they are never added
to the visible corpus, never optimized against, never used to tune the judge beyond
this Phase-0b calibration. The final report scores the human trace SEPARATELY. Marker:
`docs/eval/human-trace/PERMANENT_HOLDOUT` (see file).

## D-REFINE-01/02/03 · Last-wave issues i/ii/iii handled inside their agents
- iii (careGuard wording): safeCareResponse now takes a `variant` and rotates across
  2–3 wordings per risk/lang; LiveTools holds a per-session counter. The safety CONTENT
  (person + Mada 101 for urgent + no advice/dose) is identical across EVERY variant —
  asserted for all 4 risks. Rationale: a daily medication question must not read as a
  machine, but the safety guarantee cannot vary.
- ii (memory sensitive decline): added sensitiveKind() → the decline now reports EXACTLY
  which category is kept private (phone/medical/financial/street) and the allowed_to_say
  is FORBIDDEN from saying she cannot update anything (the original defect). A death is
  NOT medical → grief/life facts persist. Test asserts both.
- i (memory injection budget): formatSavedMemoriesForLLM is now bounded (hard maxChars,
  1200 in the live session), RECENCY-first (reverse+stable-sort so same-ms ties keep
  newest-first), with an honest "+N older kept" note. Relevance-per-turn is not possible
  at session-build time (built once) → recency is the honest bound; logged as a known limit.

## D-SCOPE-01 · This session executes as a sequence of small, gated, per-agent commits
The controlling message is a multi-agent program (A online-depth, UI-STATE, G bundle-shrink,
D family-resolver, I simulator) whose G/D/A/I agents are gated on the live realtime instrument
(slow, non-deterministic network calls) + the full suite + build + a per-agent commit. A single
foreground writer cannot honestly complete all of it with real before/after instrument evidence
in one session, and the codebase rules forbid fabricating measurements. DECISION (stricter/
honest reading): execute the highest-ROI, cleanly-correct, fully-verifiable agent(s) FIRST with
real gates + commit, establish the instrument baseline, and hand back a precise ranked remainder
— never a fabricated convergence number. First agent: UI-STATE (client-UI only, verifiable by
tests+build, fixes a named trace defect). Instrument-gated architectural agents each get their
own careful cycle. Mirrors the CONVERGENCE_LOG CLOSE precedent.

## D-UISTATE-01 · Fixed the LIVE path (LiveScreen), not the legacy AbuAI screen
Two live UIs exist: `screens/Live/LiveScreen.tsx` (backed by `services/liveSession.ts`) and the
legacy `screens/AbuAI/index.tsx` (backed by `services/realtimeVoice.ts`). Traced routing:
Home AI tile → `action:{kind:'live'}` → `openLiveAbu()` → `window.__abubankOpenLive` → App renders
`<LiveScreen>`. The legacy screen is reachable ONLY via `?legacy=1` and never from the hub. So the
state indicator was fixed in LiveScreen (which also matches the eval instrument — both use
liveSession.ts), NOT in realtimeVoice.ts. Mechanism of the "screen said listening while she spoke"
defect: LiveScreen's spelled-out word read the RAW `STATE_LABEL[state]` (no `thinking` key), while
the face/aura read the RECONCILED `presenceState` — the two could disagree. Fix: one reconciled
`liveStateWord(state, presenceState)` drives the word, enlarged to 30px. Regression in
presenceState.test.ts. Legacy realtimeVoice.ts has the same class of issue (response_done → immediate
listening) but is off the hub path → logged as remainder, not touched this session.

## D-UISTATE-02 · QA badge gated to DEV, not removed
The Home `home-qa-version` "QA: v…" badge was always visible (incl. production). Owner: hide outside
development. DECISION: gate the JSX behind `import.meta.env.DEV` (matches the existing AbuCalendar
`dev-version-badge` pattern) rather than delete it — the running build stays confirmable in
production via Settings→About + the operator diagnostic panel, so no diagnostic capability is lost.
version.visibility.test.ts strengthened to assert the DEV gate (new truth locked, not weakened).
