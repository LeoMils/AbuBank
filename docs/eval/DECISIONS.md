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

## D-M2-02 · Adversarial interception measured against a GENERATED corpus, not real turns
The brief (Part 0) is right: the monitorProbe's 0/5 real-turn interception is not evidence the
detectors work — "a detector that never fires is perfect or broken." A 5-turn sample of clean
output tests nothing. DECISION: build `src/services/monitor/adversarialCorpus.ts` — a model-free,
network-free generator of 364 cases (232 engineered to TRIGGER each detector + 132 clean/borderline
engineered to FOOL it). Anti-circularity is enforced by construction: NO case value is taken
verbatim from `outputMonitor.ts` (the same rule that caught the Gilad oracle defect). RESULT
(adversarialCorpus.test, deterministic): every detector 100% interception (LANGUAGE_IMPURE 65/65,
SOURCE_NAMED 105/105, TOO_LONG 25/25, READ_BACK 9/9, LITERAL_COUNT 28/28), 0 false positives over
128 clean cases → the detectors are proven perfect-not-broken; the 0/5 was clean output.
Two failures surfaced DURING the build and were fixed HONESTLY, not by weakening: (1) an 8-word
Hebrew "half-card" read-back echo was correctly NOT flagged because it fell under the detector's
≥50-char design bar — the corpus now echoes chunks that clear the bar (the detector was right, the
test case was wrong); (2) READ_BACK's fire set was enlarged so the ≥8 sample-size assertion is honest.

## D-M5-01 · Decompose FIRST (measured, reversible), flip on device — never claim a shrink from code
M5 is a re-architecture of how the session carries instructions, and BRIEF_AUDIT A4 already proved
<5,000 is not reachable by deletion. The brief's own discipline ("baseline fully BEFORE touching it;
flag off by default; measure off and on; regression reverts that specific removal") means the SHRINK
cannot be honestly claimed from a code change — the ON-path changes model behaviour every turn and must
be device-measured for warmth/parity. DECISION (stricter/honest reading, mirrors D-SCOPE-01): this
iteration lands the fully-verifiable, ZERO-behaviour-risk part — a precise baseline + a loss-less
per-intent DECOMPOSITION (`intentInstructions.ts`) that leaves `buildLiveInstructions` byte-identical
(flag-OFF payload unchanged, all existing tests pass) and MEASURES the projected per-turn payload. The
ratchet (14,000) is NOT lowered: the default assembled size is unchanged, so lowering it would be a
false shrink claim. `classifySections` THROWS on any unclassified section, so the decomposition can
never silently drop a rule. HONEST LIMIT recorded and asserted false-today: the always-on core is
5,886 (SAFETY 1.3k must ship every turn; persona 2.2k); <5,000 additionally requires condensing the
persona, a warmth trade that is a DEVICE off/on measurement — not deleted here. The ON-path wiring
into liveSession (buildCoreInstructions + per-response intentGuidance injection, behind a default-OFF
flag) and startup pre-warm are the device gates, logged open with exact numbers — never a fabricated
convergence number.

## D-M4-01 · Non-verbal in-flight cue = a soft tone + a distinct word, reusing the thinking aura
OWNER_CHECKLIST #6: while Abu looks something up she must STAY SILENT (M1 owns "no words before the
answer"), but a soft cue/tone while she looks is explicitly fine — a frozen-looking screen is the
defect. DECISION: fire onLookup ONLY on get_current_info (the tool with a real network wait); family/
contact lookups are silent-grounded and instant, so they do NOT cue (a tone on every resolve_contact
would be noise). The cue is a pulse mirroring the existing onThinking hint: liveSession fires it in
handleToolCall (after the call_id dedup, so a duplicate completion shape never double-pulses),
observation-only — it touches no VAD/turn/audio machinery. The UI plays soundLookup (soft two-note,
self-gated by canPlay so it is silent while she speaks and respects mute) and shows a DISTINCT honest
word "מחפשת…", REUSING the 'thinking' aura rather than adding a new AbuPresence visual (smallest safe
change; a new presence asset would need its own device/browser proof). It clears on the next state
transition exactly like thinking, and her speaking always wins in both the aura and the word, so the
screen can never claim she is still searching after she has started to answer (the same anti-lie
discipline as D-UISTATE-01). EVIDENCE: liveSession.test (pulse only on get_current_info, no double-
pulse), presenceState.test (מחפשת… + speaking-wins), sounds.test (fail-silent) are CODE; the audible
tone and the on-screen render are DEVICE evidence (OWNER_CHECKLIST #6), logged open — not claimed here.

## D-P0-SURNAME-GUARD · A spoken surname is EVIDENCE — an unconfirmed one ASKS, never silently resolves (fabrication fix)
Owner amendment (correcting my own adversarial finding #1): the v0.261 subsetResolve resolved a
unique given name even when the spoken SURNAME belonged to someone else — so "יצחק רבין" would
confidently return the family Yitzhak. That is FABRICATION. ORDERING DECISION (logged, deviates from
the owner's "apply after Layer-2"): I fixed this BEFORE starting Layer-2 because it is a live
fabrication risk in shipped production-candidate code, and a wrong confident answer is worse than a
miss (the repo's own standard) — a correctness bug outranks net-new coverage; the "after Layer-2"
ordering assumed Layer-2 was in flight, which it was not. FIX: a surname (a spoken word matching no
entity) is evidence. subsetResolve returns CONFLICT unless the surname is a confirmed token of the
matched entity's OWN names; whoIs no longer silently asserts identity on a conflict (falls to
not_found → the tool asks), resolveContactTarget returns a single-candidate ambiguous (ask), and
suggestForMiss names the exact candidate so Abu asks "did you mean <given name>?". A CONFIRMED surname
still resolves. This supersedes the v0.261 assertion that "גלעד אבורדי" resolves silently — it now
ASKS, which is exactly the owner's remedy ("do not resolve silently. Ask one short question"). Regression
fullNameLookup.test: family given name + a public-figure surname NEVER resolves; 0 silent resolves by
givenName+unknown-surname across all living people. Reuses the misheard-suggest ask path — one uniform
"did you mean…?" for both a misheard name and an unconfirmed surname.

## D-P0-MISHEAR · A misheard name ASKS "did you mean…?"; garble asks to repeat — never a silent lecture
Device P0: STT mangled a spoken nickname to "טורקי"; the resolver correctly declined, but declining
SILENTLY let Abu answer the wrong sense of the word (a lecture about Turkish coffee), then fail the
same lookup again. DECISION: add `suggestClosestPerson` — when a name does NOT resolve, find the
closest entity by phonetic+edit similarity; if best ≥ 0.5 return a SUGGESTION (looser than a
resolution — a question is safe, so it need not be unambiguous), else null. Wired into people_lookup
(who + contact) as a new `suggest` status whose allowed_to_say is "ask 'התכוונת ל<name>?' ONLY — state
no fact, look up nothing else, never lecture about an unrelated meaning of the word"; a null suggestion
(genuine garble) becomes "לא שמעתי טוב, תגידי שוב" so Abu never confirms noise. This is asymmetric on
purpose: SUGGEST asks (safe even if wrong), RESOLVE asserts (must be confident) — so a weak 0.6 match
that must not become an identity can still become a question. Regression mishearSuggest.test: a
one-letter-mangled name suggests that person; garble → null. HONEST LIMIT (logged): the "never repeat
the same failed lookup twice" is session state (a per-session failed-name set in liveSession), not
deterministic here; and "never lecture" is instruction-enforced — no deterministic guard catches a
model that lectures anyway. The deterministic core (suggest vs garble) is the shippable part.

## D-P0-FULLNAME · Subset matching — a known given name + an unknown surname must resolve, never not_found
Device P0: people_lookup("גלעד אבורדי") returned not_found though גלעד is in the dataset. Mechanism
(confirmed in code): the name index holds "גלעד", not the full "גלעד אבורדי", and the edit-distance
fuzzy fallback is too far (a whole extra word). The 739-variant oracle covered given-name SPELLING
variants, never "given name + surname where the surname is absent from the data". DECISION: add
`subsetResolve` — split the spoken name into words; if exactly ONE person in the dataset is named by
any word (the rest an unknown surname), that person WINS; if several DIFFERENT people are named,
return ambiguous (the caller asks), never a silent wrong pick; a single word is left to the exact/
fuzzy paths. Also match a word against the FIRST token of a multi-word display name so someone
indexed as "אריאל (בן טאבלה)" is findable by "אריאל". Wired into whoIs + resolveContactTarget.
Regression fullNameLookup.test: גלעד אבורדי→Gilad, EVERY living person findable by givenName+surname
(miss 0), "מור לאו"→ambiguous (never a silent pick). Deterministic correctness fix, no flag (D-QA-02).
Known limit (logged, adversarial pass): subset ignores the surname, so a wrong surname still resolves
the unique given name — acceptable for the P0 (she meant that person); and a given name shared by a
living+deceased person still falls to not_found in whoIs (the contact path asks). Surname-bearing
oracle variants for the generated set are the follow-up.

## D-ONLINE-04 · One GENERAL search loop replaces the per-topic gates; the cheap model IS the judge
The online path had a relevance gate for PRICES, with a plan to add one for news, one for weather,
one for film. An 81-year-old asks ANYTHING, so that patchwork never covers her. DECISION: delete the
price-specific logic (isPriceQuery / priceNearProduct / price-token extraction) and build ONE general
agentic loop (generalSearch.ts): SEARCH → FETCH pages first-wins → JUDGE+SYNTHESIZE with a cheap model
→ REFINE the query once (budget permitting) → HONEST no_answer. The key insight: the cheap model in
synthesize.ts ALREADY makes a general judgment — "does this text answer THIS question?" returning a
clean answer or no_answer — so the JUDGE and SYNTHESIZE are the SAME call, with NO type heuristic
("has a currency symbol") anywhere. REFINE (reformulate to the content words, general across he/es/en)
is what makes it self-correct instead of returning a page description. Budget honoured: a synth-time
RESERVE is subtracted from the fetch ceiling so fetch+judge together stay under 6s (the first run hit
7335ms because synthesize ran AFTER the fetch ceiling — measured, then fixed; max is now 5622ms).
MEASURED over 63 diverse he/es questions: 87.3% pass, 0 hard fails, 0 source-name leaks, 8 HONEST
misses (JS-rendered listings / live widgets — a no_answer, never a dump). ORACLE LIMIT stated in the
report: there is no independent oracle for the web, so a pass asserts only a real answer of the
requested KIND + no source named + in-budget + consistency + honest-miss — never the VALUE's correctness.

## D-ONLINE-05 · ONLINE_DEEP_FETCH moved from a Preview env var to a CODE flag — this blocked the merge
A Preview-scoped env var does NOT survive a merge to production: Martita would silently get shallow
snippet answers with nobody noticing. DECISION: the DEFAULT belongs in CODE (flags.ts) with the
measurement that justifies it; the env name stays ONLY as an ops override (kill-switch / force-on).
Default is ON because "never worse than the snippet" was MEASURED (off vs on: OFF-only=0 — the loop
never loses where the snippet wins; ON-only=2 — it is strictly better on some). The prefetch warm store
is already a code-level const; its default stays OFF pending the on-device freshness-vs-latency
measurement (warmStore.test proves the <1s warm hit but the freshness trade is a device judgment).
Reported exactly which flag is ON with what evidence, and which stays OFF and why.

## D-C-01 · Track C: spend the authorized budget on the layer the owner feels — measure, fix, re-measure
Three prior sessions spent $0, leaving Layer-3 (model behaviour) almost untested. With budget
authorized (cap $5, actual ~20 text-mode realtime turns << $1), the M3 probe found a REAL intermittent
defect the deterministic layer could never catch: asked to schedule "פגישה עם אח של מור", the model
resolves the person correctly (people_lookup → Leo) but 1/2 runs wrote the RAW relationship phrase into
the calendar TITLE. FIX (instruction, not a flag — a correctness clarification per D-QA-02): the # Tools
calendar rule + the prepare_calendar_event `title` description now require the resolved NAME everywhere.
RE-MEASURED on the instrument: 0/3 wrote the phrase (was 1/2). This is the failure→fix→re-measure loop
the brief asks for, with the probe itself as the durable regression harness (a model-behaviour defect
cannot be a deterministic unit test; scripts/eval/m3Probe.ts is re-run after any calendar-titling edit).
Accept-correction PASSED as-is (5/5 conceded, 0 argued) — no change needed, logged as verified not
assumed. Honest limit: an instruction change is measured-to-help, never a guarantee; the number is 0/3,
not "solved". Discipline held: paced calls, 0 transport failures, sub-500ms empties would have been
retried not scored.

## D-A-01 · Audio was CANNOT-VERIFY, not CANNOT-BUILD — build it now, flag-gated, owner hears the diff
Every prior session deferred audio as "device-only". The brief is right that this conflated two
things: the AUDIBLE result needs his ear, but the MECHANISM is fully buildable and unit-testable now.
DECISION: build the two documented fixes behind env-overridable flags, OFF by default, payload
byte-identical when off. (1) far-field noise_reduction on audio.input (VITE_LIVE_AUDIO_TUNE_V2) — the
documented fix for a speakerphone whose mic hears its own loudspeaker (the second-voice / self-
interruption root). (2) client barge-in truncate (VITE_LIVE_BARGE_IN_TRUNCATE) — the model streams
audio far ahead of playback, so on a real barge-in the client must response.cancel + conversation.item.
truncate the assistant item to the PLAYED position (estimated from the first audio-delta clock),
or client and server diverge and the next turn collides (conversation_already_has_active_response —
the likely "only the first sentence is audible"). RECONCILED with LIVE_INTERRUPT_RESPONSE per
BRIEF_AUDIT A3: it stays FALSE so the SERVER never auto-truncates on echo; the CLIENT truncates only
on a barge-in it actually observes. That is the correct COMBINED behaviour, not a blind flip. The two
must be enabled TOGETHER — far-field NR tames the echo BEFORE the client truncate is safe (otherwise
Abu's own echo would trigger the truncate = the exact "one word then silence" regression). Env flags
(mirroring D-ONLINE-02) so the owner enables them on a Preview build with no code change; I deploy an
A/B pair (off vs on) so he can hear the difference. Pure logic (bargeInEvents, far-field payload) is
unit-tested; audibility + echo-regression are the owner's ear (docs/eval/AUDIO_CHECK.md). NOT claimed
heard. If ON reintroduces echo-truncation, the fix is a client-side echo gate, logged open.

## D-QA-03 · SCOPE derived MECHANICALLY from the code, and Layer-1 is the CONTRACT (executed), not seeded
The deferred QA build-out's first honest slice is the SCOPE inventory, and the brief is explicit:
"derive it mechanically from the code." DECISION: scopeInventory.ts imports the SAME structured
sources the product uses (LIVE_TOOL_SCHEMAS, the Screen enum, family_data.json, and the liveSession
event switch parsed from source) — never a hand-maintained list — so a tool/screen/event added there
appears in the inventory automatically and the ledger cannot silently fall behind. The Layer-1 cells
are the tool CONTRACT the model is handed (valid types, non-empty descriptions, required⊆properties,
additionalProperties:false so unknown params are rejected, well-formed enums); these are EXECUTED
(97/97 pass), which is what moves cell-level coverage off zero honestly — not a pile of not_run rows.
The ordered entity-pair space (4160) is SIZED here but not re-run — it is already covered by
relationMatrix.test; double-counting it as new coverage would be dishonest. What is deliberately left
not_run and NAMED as next: Layer-2 failure-path BEHAVIOUR must feed GENERATED args to the handlers
(missing-required, out-of-enum, unknown-param, wrong-type) — never values verbatim from the schema,
which is the exact circularity that hid the Gilad defect — plus realtime-event invariants and every
screen via a browser harness; Layer-3 samples the unbuilt-capability declines. 56.4% is the true seeded
coverage today; the report states plainly which layer each cell belongs to.

## D-M2-04 · Classified checks kept SEPARATE from the deterministic zero-FP module; FP measured first
The three classified checks judge INTENT (distress→menu, method narration, ungrounded entity), so
they carry real false-positive risk — unlike outputMonitor.ts's surface-form detectors which have a
zero-FP guarantee. DECISION: put them in a SEPARATE module (classifiedMonitor.ts) with their own
type + callback, so the deterministic module keeps its guarantee and the FP-risky layer is judged on
its own numbers. Same rigor as the deterministic set: classifiedCorpus generates 82 cases (40 defects
+ 42 warm-correct engineered to be MISTAKEN for a defect), nothing verbatim from the source. MEASURED
100% interception, 0 FP over 42 clean. Wired into liveSession as OBSERVATION ONLY (emit + log — it can
never block or change output; proven 0 FP makes observation safe), with per-turn grounded-tool tracking
so UNGROUNDED_ENTITY distinguishes a tool-grounded family fact from one asserted from thin air. The
one-attempt classified REPAIR (buildClassifiedRepair) is built but DOUBLY gated OFF
(LIVE_CLASSIFIED_MONITOR && LIVE_OUTPUT_MONITOR_REPAIR): a redo that could blank a warm correct answer
must earn DEVICE warmth proof first. What is NOT claimed (no API spent this session, honest per the
brief): the repair round-trip latency p50/p95 and warmth off-vs-on need the realtime instrument —
logged open. Low-FP tuning: DISTRESS_MENU requires ≥2 enumerated options (a single caring
"רוצה שאתקשר ללאו?" is correct, not a menu); UNGROUNDED_ENTITY is SOFT (working memory can restate).

## D-M2-05 · Latent Hebrew \b bug found + fixed while building the classified checks
Building the entity regexes surfaced a real defect: JS \b is defined on ASCII \w only, so a \b placed
next to a Hebrew letter is a NON-boundary and the pattern silently never matches. The first cut of
ENTITY_QUESTION / ENTITY_ASSERTION / the "אני יכולה" menu check used \b and therefore missed every
Hebrew case (the corpus caught it — the value of generated tests over hand-picked ones). FIX: dropped
\b around Hebrew and used explicit space/character anchors instead (e.g. "ב[ןת] \\d+", "ה(בת|בן|…) של").
Logged so the same trap is not reintroduced elsewhere (outputMonitor.ts was audited — it does not rely
on \b around Hebrew).

## D-M2-03 · Four regex-uncatchable gaps reported as GAPS, not silently passed
The deterministic SOURCE_NAMED / READ_BACK regexes structurally cannot catch: a spoken domain with
the dots dropped by STT ("seret co il"), a Hebrew-transliterated source name with no TLD ("בוויקיפדיה
כתוב"), an "אתר של הקולנוע" with no domain, and a read-back broken below the contiguous ≥8-word bar by
punctuation/insertion. DECISION: emit these as explicit `gap` cases in the corpus and ASSERT their
count, so the report (`docs/eval/MONITOR_ADVERSARIAL_REPORT.md`) states honestly where Layer-1 ends and
a future change that closes one is flagged rather than rotting silently. NOT closing them speculatively:
extending the narration/domain regex to catch these adds real false-positive risk to innocent Hebrew,
and the owner's rule is explicit — "a filter that blocks a good answer is worse than the defect." They
close only if a real device transcript proves they matter (logged open in the ledger).

## D-UISTATE-02 · QA badge gated to DEV, not removed
The Home `home-qa-version` "QA: v…" badge was always visible (incl. production). Owner: hide outside
development. DECISION: gate the JSX behind `import.meta.env.DEV` (matches the existing AbuCalendar
`dev-version-badge` pattern) rather than delete it — the running build stays confirmable in
production via Settings→About + the operator diagnostic panel, so no diagnostic capability is lost.
version.visibility.test.ts strengthened to assert the DEV gate (new truth locked, not weakened).
