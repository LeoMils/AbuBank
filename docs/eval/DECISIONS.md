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

## D-INSTRUMENT-01 · Realtime stays the behavioral instrument; throttle solved by pacing (owner correction)
An earlier decision proposed demoting to the gpt-4o CHAT harness as the volume workhorse after
the realtime WS throttled under a ~60-call noise floor. Owner corrected: DO NOT demote — the chat
harness produced 36.7% and hid the preamble failure; it may be used ONLY for provably
model-independent numbers, each labelled "not measuring Abu". The throttle is a VOLUME problem,
solved by: pacing + exponential backoff on connect failure; reusing ONE connection across turns;
detecting a sub-500ms empty response as a CONNECT ERROR (never a score of 0 — `isTransportFailure`
in scoredEval.ts EXCLUDES it and retries); and shrinking volume (noise floor = 3 runs × 6-case
subset, not 60). scoredEval defaults to `instrument:'realtime'`; noiseFloor defaults to realtime,
6 cases × 3 iters. The throttled NOISE_FLOOR.json artifact was deleted (untrusted).

## D-GD-01 · G/D proceed on DETERMINISTIC acceptance + a small realtime probe (owner correction)
Owner corrected: G/D do NOT need a full noise floor first (that is the convergence-loop ratchet's
prerequisite, not G/D's). Most of G/D acceptance is deterministic and needs no model: bundle size
(pure measurement + a ratchet test), the full Hebrew pair matrix against the resolver (pure unit
test, relationMatrix.test), and the no-URL payload assertion. The ONE model question — does a
relation query now produce a people_lookup call — is a handful of realtime probe calls
(relationProbe.ts, one reused connection). Baseline "before" = 0 tool calls (already proven).

## D-GD-02 · Remove the family portrait ENTIRELY; per-intent re-injection = the tool itself
The 10,902-char `buildFamilyPortrait()` (44% of the instructions) was the reason relation queries
answered from the prompt. Decision: delete it entirely (module + import + call + its test — it had
no other importer) rather than gate it, because "re-inject per-intent at call time" in the realtime
architecture IS the tool: people_lookup returns the family facts only when a family intent fires,
and history_lookup for life story. The # Family and People + # Tools sections were rewritten from
"answer from what you KNOW (the portrait)" to "call people_lookup silently, speak one sentence, the
relation only, no derivation; accept a correction about her own family at once, never argue." Tests
that asserted the portrait was IN the bundle were flipped to assert it is GONE and the tool is forced
(new truth, not weakened). The standing safety-guard phrase "you are Martita's FRIEND, not Martita"
was preserved verbatim (companionSafety.guard). RESULT (realtime): relation tool-call rate 0/5→5/5.

## D-ONLINE-01 · Price half of A: first-wins PAGE fetch, shared module, one behavior
The perfume price never surfaced because the online path spoke from a search SNIPPET. Built
`src/services/online/firstWins.ts` (pure, injected search + fetchPage seams): fetch top-N result
PAGES in parallel, speak from the FIRST whose text contains the answer (price token), abort the
rest; 4s soft / 6s hard budget; below the ceiling return what is known. ONE module serves both the
eval instrument (firstWinsOnlineFetch) and the live endpoint — no second online path.

## D-ONLINE-02 · Endpoint page-fetch behind default-OFF ONLINE_DEEP_FETCH (no test/prod change)
Wired first-wins into api/abuai-online.ts (both the provider and openai answer paths) behind
`env.ONLINE_DEEP_FETCH`, DEFAULT OFF. Rationale (stricter/safe reading): with the flag unset the
endpoint runs identical code to before, so all three endpoint tests + current prod behavior are
unchanged; device activation is one Vercel env step, mirroring the existing ONLINE_PROVIDER staging
pattern this repo already uses. The capability is PROVEN on the realtime instrument now; device is a
documented deploy step, not claimed live.

## D-ONLINE-03 · Never worse than the snippet (protect cinema) + ttft = first spoken token
First measurement showed first-wins REGRESSED cinema (JS-rendered listing pages have no film list in
static HTML, while the Brave snippet did). Fix: use page content ONLY when a page truly contained the
answer (`r.hadAnswer`); otherwise fall back to the search snippet — so page-fetch is strictly ≥ the
old behavior. Also fixed realtimeRunner ttft to be set on the first SPOKEN output-text delta (not on
the function_call event), so ttft honestly includes the tool round-trip and measures time-to-first-
token as Martita would hear it.

## D-QA-01 · Adversarial reviewer runs INLINE, not as a subagent (repo rule overrides the brief)
The FULL-QA brief asks for a subagent adversarial reviewer. The repo's permanent V4 rule forbids
subagents/parallel writers. Stricter reading → obey the repo rule; the adversarial pass runs inline
(see BRIEF_AUDIT.md "ADVERSARIAL REVIEWER PASS"). Logged, not asked.

## D-QA-02 · Deterministic correctness fixes with an oracle do NOT need a runtime flag
The brief's flag discipline ("ship behind a flag, measure off/on") is for BEHAVIOURAL/risky changes
(M1 lifecycle, M2 filter, M4 prefetch). A DETERMINISTIC resolver correctness fix proven against an
independent oracle (M3 never-null vs FAMILY_GROUND_TRUTH) is strictly more correct and is guarded by
a Layer-1 test at 100% coverage — a runtime flag would only add a code path where the bug persists.
So M3 shipped without a flag; M1's structural lifecycle (device, risky) stays flag/device-gated.

## D-M3-01 · Gilad null → grandchild_in_law term + never-null path fallback in whoIs
Mechanism: whoIs derived relationToMartita from relationshipOf only, which had no term for
spouse-of-a-grandchild → null → role → null. Fix: added `grandchild_in_law` (one marriage hop,
"בעל הנכדה/אשת הנכד") AND wired `describePathBetween` as the whoIs fallback so a connected entity is
NEVER null. FAMILY_GROUND_TRUTH.md now shows 65 people, 0 gaps, 0 not_found pairs. Participant
substitution ("פגישה עם אח של מור") + "accept correction, never argue" are model-behaviour (Layer 3),
logged open — NOT closed by this deterministic fix.

## D-M1-01 · Deleted the anti-preamble instruction text; did NOT flip interrupt_response
Deleted "# Before a Tool Call" (device-disobeyed 100%, does nothing, ~630 chars). The preamble is
audio-only and unmeasurable on the text instrument, so its structural fix (cancel early response;
silence between tool call and result) is a DEVICE-verification item (OWNER_CHECKLIST #6). Did NOT
flip `LIVE_INTERRUPT_RESPONSE` back to true for barge-in truncation: it is false ON PURPOSE (a device
echo-truncation fix). Flipping it blind would reintroduce "one word then silence". See BRIEF_AUDIT A3.
The instantAcknowledgement code-seed guard is kept (it guards a real code path).

## D-INPUT-01 · Input oracle: skeleton + base/prefix dual-index; ambiguous→ask; principled bar
The device miss "גילעד"→not_found is the oracle problem on the input side. Fixes: (1) a
matres-lectionis SKELETON (drops optional yud/vav) resolves STT-mangled names; (2) resolvePersonId
indexes+tries BOTH the base and prefix-stripped forms so prefix-initial names (לאו/מור/מרתה) match
by their true spelling; (3) hebrewSkeleton uses normalizeBASE (a name's own initial ל/מ is not a
prefix — לואיס must stay "לס", not "ס"); (4) the reach path returns AMBIGUOUS (asks, naming a
deceased match too) rather than not_found or a wrong edit-distance guess; the whoIs/fuzzy internal
skeleton stays conservative (≥2 chars) so a non-name is still an honest not_found. The oracle
(inputOracle.test) asserts not_found=0 AND wrong=0 over generated variants, EXCLUDING genuinely
indistinguishable ones (empty skeleton, or a skeleton that belongs to another person after a single
STT mutation) — a principled bar, documented, not overfitting the generator. No runtime flag
(deterministic correctness vs the generated oracle; D-QA-02).

## D-TEAM-01 · Single foreground writer (repo V4 rule); Workflow tool not opted in
The brief invites "as much parallelism as the rules permit." The repo V4 rule forbids
subagents/parallel writers, and the Workflow tool requires explicit opt-in (not given). So this
overnight run is a single sequential foreground writer, commit+push per mechanism. Reported.

## D-UISTATE-02 · QA badge gated to DEV, not removed
The Home `home-qa-version` "QA: v…" badge was always visible (incl. production). Owner: hide outside
development. DECISION: gate the JSX behind `import.meta.env.DEV` (matches the existing AbuCalendar
`dev-version-badge` pattern) rather than delete it — the running build stays confirmable in
production via Settings→About + the operator diagnostic panel, so no diagnostic capability is lost.
version.visibility.test.ts strengthened to assert the DEV gate (new truth locked, not weakened).
