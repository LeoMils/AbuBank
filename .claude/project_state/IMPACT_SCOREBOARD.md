# IMPACT_SCOREBOARD

The user-facing impact of every cycle. BENCHMARK_SCORE = % of real user-moments
that behave correctly (`npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts`).
A cycle is only "done" when this table has a new row.

| Version | BENCHMARK_SCORE | Δ | Moments | Change shipped | Evidence |
|---|---|---|---|---|---|
| 0.144.0 | n/a (intake) | +16 | — | **INTAKE REBUILD s5 · P3 garble.** Deterministic phonetic fold in the seam (ק/ך/ח→כ, ט→ת, ע→א, ב→ו) → a single near-homophone STT slip in a relation term still resolves ("החטן של מור"→גלעד); gated to ≥3 chars + unambiguous folds → never a WRONG person (real relative or nobody). Permanent garble mutator + suite (survival floor; word-splits left to STT-recovery honestly). | CODE — garble 16/16 + FULL suite **11512 pass / 0 regressions**, tsc + build. NOT device-proven. |
| 0.143.0 | n/a (intake) | +8 | — | **INTAKE REBUILD s4 · P1 wired live.** On a pattern miss (`runtimeFullTurn` needsLLM), understanding now runs via a REAL transport (`/api/abuai-chat`, strict json_schema), grounds through the engines, and enriches LLM grounding with graph-resolved people + engine-parsed date/time (never invents; failed interpret never breaks a turn; latency reported). Wired into `buildFullTurnTools`. | CODE/MOCK — understandingIntake 19/19 + live-wiring 3/3 + FULL suite **11496 pass / 0 regressions**, tsc + build. **PREVIEW/PENDING**: real provider call + latency proven only on deploy. NOT device-proven. |
| 0.142.0 | n/a (intake) | +13 | — | **INTAKE REBUILD s3 · P1 foundation — understanding-first layer.** `understandingIntake.ts`: strict `StructuredIntent` schema + `interpretUtterance` (injected transport, MOCK-provable) + `groundIntent` (PURE: person refs→seam, date/time→date engine, nothing invented) + `normalizeIntent` (malformed→safe unknown). | CODE/MOCK — understandingIntake 13/13 + FULL suite **11488 pass / 0 regressions**, tsc + build. **NOT wired live** (patterns still the gate); real-provider latency = PREVIEW, unproven. NOT device-proven. |
| 0.141.0 | n/a (intake) | +41 path tests | — | **INTAKE REBUILD s2 · P2 complete — seam feeds ALL paths.** create/title ("עם בת הזוג של מור"→"פגישה עם יעל", "עם החתן של מור"→גלעד), search (`personPhraseResolver` now DELEGATES to the seam — deleted the parallel resolver engine), ledger (`extractChange`/`classifyIntake` take an injected person-resolver: "הבת של מור גרה בחיפה"→fact for אופיר; poison still LAWS-refused). Added חם/חמות; hardened `parseRelationQuery`. | CODE — all-paths 11/11 + FULL suite **11474 pass / 2 todo / 0 regressions** (1 create-title test updated to the resolved name, per P4), tsc + build. NOT device-proven. |
| 0.140.0 | n/a (intake groundwork) | +310 generative | — | **INTAKE REBUILD s1 · P2 — relation morphology seam.** Understanding-first map of the current pattern-bound intake (chat `runCognitiveTurn/classifyIntent`, calendar `isCreateIntent`, ledger `classifyIntake/extractChange`) + the ONE morphology normalization seam (`src/truth/relationMorphology.ts`): table-driven Hebrew inflection space (bare/ה/construct/possessive-suffix/analytic/plural) → canonical `RelationType`, now the gate in `answerFamilyRelation`. NEW: in-law who-is (`מי החתן של מור`→גלעד, `מי הכלה של מור`→ירדן) + every inflection resolves to the same person instead of punting to the LLM; honest emptiness kept. | CODE — morphology 310/310, FULL suite 11433 pass / 2 todo / **0 regressions** (baseline 11123), tsc + build. NOT device-proven. P1/P3–P8 + verification regime NOT started. |
| 0.8.3 (baseline) | 100.0% | — | 38/38 | benchmark established (calendar 15, online 6, conv-os 4, companion 7, failure-copy 4, routing 2) | benchmark run |
| 0.8.5 | 100.0% | +12 moments | 50/50 | **Spanish calendar create** — was 0% (isCreateIntent=false on "agendá una reunión con Gabi mañana a las tres"); now full es create (intent/who/date/time/AM-PM/confirm). Added 12 `spanish` benchmark moments. | benchmark run + suite 5982 |
| 0.8.6 | 100.0% | +4 moments | 54/54 | **Spanish location** — was 0% ("en el café Morocco" → cancel/null); now extracted inline + merged into a pending event ("en casa"/"en la clínica"). | benchmark run + suite 5982 |
| 0.8.7 | NORTH_STAR 99.5→**100%** | 588 eval cases | — | **Eval Engine** built (10 capabilities × 8 dimensions, real pipeline, deterministic + judge-marked-uncertain, 4 reports, regression detection). It FOUND a real bug: "sí, agendalo" not confirmed → fixed (es confirm). | eval run docs/eval/ + suite 5984 |
| 0.8.8 | NORTH_STAR **100%** · JUDGE **100/100** | 1095 cases + 69 judged | — | **Judge pass + coverage**. Built a SEPARATE rule judge (judgeRunner.ts, NOT AbuAI) on deterministic prose. It FOUND + fixed: Spanish emotional fallback replied in Hebrew (→ es companion lines); online gaps "מי שיחק"/"מתי שוקעת השמש". Coverage expanded to all minimums (family 165/emotional 147/continuity 111/hebrew 180/online 87…). | docs/eval/ + judge-results.json + suite 5984 |
| 0.79.0 ✅DEVICE | 100.0% (floor held) | **DEVICE_VERIFIED: voice audio PLAYS — Martita heard AbuAI speak (first real audio).** Hebrew STT + basic memory partially work. | — | **Pipeline default + Realtime beta**. DEVICE findings (Leo iPhone 2026-07-15): audio plays ✅, but pipeline too SLOW/ROBOTIC/no-barge-in (structural) + a date bug (answered "today" for "yesterday"). Next: Realtime (Option A) beta — device-verify audible Live-like voice; pipeline stays fallback. (Leo chose Option C, VOICE_ARCHITECTURE_VERDICT). The default was OpenAI Realtime WebRTC (useRealtime=true), unproven on device + autoplay-blocked remote audio → user heard NOTHING. Now default = reliable pipeline (proven server TTS via gesture-unlocked AudioContext); Realtime = opt-in beta (localStorage abu-voice-realtime-beta=1). Also fixed the Realtime <audio> autoplay bug (append to DOM) behind the flag — device-gated. | RED-first voiceModePreference 3/3 + realtimeAudioOut source-contract 3/3 + updated 11 useRealtime source-contracts (fixed-truth, not weakened) + full suite 10822 pass/2 todo + tsc + build; fresh preview; PENDING OP-003 device proof |
| 0.78.0 | 100.0% (floor held) | Spanish family "quién es Mor" grounded (was punting to LLM) | — | **Spanish family identity G2** (overnight cycle 3). `quién es Mor`/`quién es Ofir` were classified general → LLM (invented-fact risk) though the graph could answer in Spanish. Now classifier recognizes `quién es <known name>` + familyReasoner answers via describeRelation(...,'es') → "Abu es madre de Mor" / "Abu es abuela de Ofir (a través de Mor)"; lang threaded through the family case. | RED-first spanishFamilyIdentity 3/3 (through controller, src≠llm) + family/gender/spanish non-regression 36 + full suite 10816 pass/2 todo + tsc + build |
| 0.77.0 | 100.0% (floor held) | MEMORY P0 (trust): no longer dishonestly implies it has memory | — | **Memory honesty** (overnight cycle 2). Device: AbuAI said "sometimes I miss things", implying memory it lacks. Wiring truth: current conversation IS passed to the model (fullTurnBridge→sendMessage), no cross-session memory. SYSTEM_PROMPT now forbids "שכחתי"/"לפעמים אני מפספסת" → honest "לא יודעת" for anything not said this conversation; remember what WAS said. Regression memoryHonesty (source-contract). Continuity half still needs device repro. | RED-first memoryHonesty 2/2 + full suite 10813 pass/2 todo + tsc + build |
| 0.76.0 | 100.0% (floor held) | VOICE P0: iOS no longer hangs on "מקשיבה" forever (device-gated) | — | **iOS Whisper STT + listening watchdog** (overnight cycle 1). Device root cause: iOS webkitSpeechRecognition could start and fire no events → infinite "מקשיבה". Fix: on iOS skip Web Speech → Whisper (audio/mp4) primary; a bounded listening WATCHDOG aborts+falls back on any stall. Pure `src/services/sttStrategy.ts` (isIOS / shouldUseWebSpeechPrimary / LISTEN_WATCHDOG_MS) unit-tested; wired minimally into index.tsx. Actual capture stays DEVICE-GATED → OP-003. NOT overclaimed. | sttStrategy 5/5 + voice-wiring 52 + full suite 10811 pass/2 todo + tsc + build; fresh preview deployed; PENDING OP-003 device proof |
| 0.75.0 | 100.0% (floor held) | DEVICE P0 root-cause report + online no-longer-hallucinates | — | **DEVICE P0 triage + ONLINE grounding gate**. Real iPhone test on 0.74.0 exposed 4 broken foundations (voice/memory/online/calendar) → root-cause report `docs/DEVICE_P0_ROOT_CAUSE.md`. Highest-severity PROVABLE fix landed: `/api/abuai-online` returned `ok:true` with 0 sources (hallucinated World Cup fixtures as fact); now zero sources ⇒ honest failure `ONLINE_NO_RESULTS` (§47 / NO TOOL RESULT = NO CLAIM). web_search itself is functional (PREVIEW-verified weather→1 source). Voice=device-gated (no watchdog on iOS webkitSpeechRecognition → infinite "מקשיבה"); memory/calendar need device repro. | RED-first regression onlineGroundingGate 2/2 (stash-verified) + online suite 65 + full suite 10806 pass/2 todo + tsc + build; PREVIEW re-verify on redeploy |
| 0.74.0 | 100.0% (floor held) | family conversation: possessive spouse queries grounded (was punting to LLM) | — | **CONVERSATION_GAP_MAP + G1 fix** (parity-program cycle 7). Built `docs/CONVERSATION_GAP_MAP.md` by driving the REAL controller over a broad Hebrew/Spanish/mixed corpus — key finding: the controller is the sole runtime path but its grounded family coverage is weaker than the deprecated `tryGroundedAnswer`, so grounded-answerable turns punt to the LLM. Fixed the top machine-provable gap (G1): the POSSESSIVE spouse form "מי בעלה של אופיר" / "מי אשתו של עילי" was punted (reasoner + classifier matched only "הבעל של"/"האישה של"); now grounded → גלעד / ירדן. | RED-first regression spouseQueryForms 5/5 (direct + through-controller) + family/gender non-regression 56 + full suite 10804 pass/2 todo + tsc + build. G2 (Spanish family) / G3 (referent-carry) queued. |
| 0.73.0 | 100.0% (floor held) | Spanish create completes end-to-end (ambiguous hour + cancel + clean title) | — | **Spanish create completes** (parity-program cycle 6). (1) A single-utterance es create with an AM/PM-ambiguous bare hour ("anotá una cita el viernes a las diez") used to ask "¿A qué hora?" then dead-end on "dale"; now resolves to the default reading → confirm → saves once at 10:00 (es analog of 0.68.0). (2) Spanish "no"/cancelá/dejá/olvidate now cancels in Spanish instead of punting to the LLM; "no, a las cuatro" stays a correction, not a cancel. (3) Person-less es title is the schedulable noun with correct gender ("una cita"/"un turno"). | RED-first regression spanishCreateCompletion 8/8 (stash-verified red→green) + spanish/fragmented non-regression + full suite 10799 pass/2 todo + tsc + build. Device VOICE gap → OP-002. |
| 0.72.0 | 100.0% (floor held) | relation-between resolves Martita by her everyday name | — | **relation-between-Martita alias** (parity-program cycle 5). `מה הקשר בין אופיר למרתה` answered "לא יודעת" because "מרתה" (Marta — the everyday spelling of canonical "מרטיטה") was not a recognized alias, so `findNode("מרתה")` was null and the relation-between handler bailed. First divergence was NAME RESOLUTION, not the handler (`מרטיטה`/`אבו` already worked). Added "מרתה" to Martita's aliases in `knowledge/family_graph.json` (runtime) + `knowledge/family_data.json` (source of truth) → `מה הקשר בין אופיר למרתה`→"מרטיטה הסבתא של אופיר (דרך מור)". Feminine forms (הסבתא/הנכדה) + ex-spouse directionality unchanged. | RED-first regression relationBetweenMartita 4/4 + ofir/exSpouse 23 + validate:family + validate:knowledge + full suite 10792 pass/2 todo + tsc + build |
| 0.71.0 | 100.0% (floor held) | family ex-spouse now answered deterministically, both directions | — | **Family ex-spouse directionality** (parity-program cycle 4; release-gate for family correctness). `מי הגרוש של מור` fell through to a profile-blurb lookup ("מור, הבת שלך…") and `answerFamilyRelation` returned null (no ex-spouse REL rule) → LLM guess; the reverse `רפי הוא הגרוש של מי` only "passed" by coincidence (Rafi's blurb mentions מור). Added an `ex_spouse` REL rule set (forward `מי הגרוש/הגרושה של X`, from-whom `ממי X גרושה`, reverse `X (הוא) הגרוש של מי`) over the SYMMETRIC `exSpousesHe` edge → all resolve to `exSpouseOf(the named person)`; rendered `הגרוש/ה של X`. `מי הגרוש של מור`→רפי, `ממי מור גרושה`→רפי, `רפי הוא הגרוש של מי`→מור. Partner + Ofir feminine forms unchanged. | RED-first regression exSpouseDirectionality 7/7 + genderMatrix/rc3/ofirGenderRegression 56 + full suite 10788 pass/2 todo + tsc + build. Also fixed pre-existing drift: copyTurnsButton version pin was stale at 0.67.0 → now tracks the single source. |
| 0.70.0 | 100.0% (floor held) | Spanish create now first-class es end-to-end | — | **Spanish create stays Spanish** (§20.2). After 0.69.0 the es create SAVED but every AbuAI turn was Hebrew (clarify "באיזו שעה?", confirm "…נכון?", save "קבוע —"). Threaded the create's language (remembered on the draft for cross-turn continuity, since "a las cuatro" detects as he) through clarify/confirm/save/cancel + rendered the Hebrew "פגישה עם X" title as "una reunión con X"; `composeCreate` bypasses Hebrew persona shaping for es. Hebrew creates unchanged. | gold replay spanishCreateLocale 5/5 + AbuAI/AbuCalendar/eval 9923 pass + tsc + build |
| 0.69.0 | 100.0% (floor held) | mandatory §20.2 scenario 0→working | — | **Spanish transcript locale integrity** (parity-program cycle 2). THE mandatory Spanish scenario "Agendá una reunión con Gabi mañana a las tres" was broken end-to-end in the runtime: the Hebrew STT-recovery dedup rule (Hebrew-only word boundary) matched a false "a a" duplicate across "mañana"+"a" and dropped the preposition → "mañana las tres" → ES clock regex failed → asked "באיזו שעה?" in Hebrew → "dale" dead-ended, nothing created. Fixed the dedup boundary to be script-agnostic (\p{L}\p{M}); scenario now creates once at 15:00 and "dale" saves. | gold replay 5/5 + AbuAI/AbuCalendar/eval 9918 pass + tsc + build |
| 0.68.0 | 100.0% (floor held) | +2 parity moments (gold replay) | — | **Fragment ambiguous-hour PARITY** (parity-program cycle). Fragment "drip" create with an AM/PM-ambiguous bare hour ("תקבעי"→"עם מור"→"מחר בשמונה"→"כן") used to stay ambiguous forever and dead-end on "כן" (nothing saved); now the fragment slot-fill resolves it to the SAME default the single-utterance smart layer uses → confirm → "כן" saves exactly once. Fragment create === single-utterance create. Also: bare period correction ("לא בערב") at confirm now flips AM→PM (never-lose-a-correction). | gold replay 6/6 + AbuAI 4302 + AbuCalendar/eval 5611 + tsc + build |

## Cycle log
- **0.118.0 (MASTER MANDATE — Cycle 38: P4 GENERATIVE MARATHON + 2 divergence fixes)** — Built the P4
  marathon: a seeded generator composing multi-turn sessions (family "who" × calendar CRUD with
  pronoun referability × date arithmetic × memory store/recall/forget) driven through the REAL app
  entry — index.tsx-faithful guarded pronoun/follow-up preprocessing + `ExecutiveCognitiveController`
  with mocked llm/online tools (fast, free, deterministic; NOT runCognitiveTurn directly). First batch
  (120 sessions) → 117 breaks in TWO general classes, both LAB-vs-APP divergences (P0 per the governing
  rule): (1) DATE ROUTING — `dateReasoner` handles "בעוד N ימים" (proven in the generalization suite)
  but `classifyIntent` only routed the "איזה יום … בעוד" ordering, so "בעוד … איזה יום" fell to the
  LLM; fixed `RELATIVE_DATE_QUERY_RE` to accept both orderings (117→9). (2) DIALOGUE GUARD — a repeated
  FACTUAL answer (two questions sharing "מור"; two dates on the same day) was suppressed as a loop and
  replaced with a clarification; now `guardDialogue` only escalates a repeated STUCK/non-answer line
  (9→0). Corrected a `productRealityCorpus` test that ENCODED the bug (testing rule: fix the truth,
  never weaken). A **400-session batch passes CLEAN**. Both fixes are general mechanisms, not phrase
  lists. Evidence (CODE at app-entry level): generativeMarathon 400/400; benchmark **100%**; FULL
  suite **11017 pass / 2 todo**; typecheck + build clean. NEXT: widen the generator (relation-phrase
  creates, "the last one", mid-flow corrections, He/Es/mixed, style rules) + raise batch toward
  thousands; then P2 LLM semantic extraction; update LEO_TYPED_TEST_SCRIPT + latency table.
- **0.117.0 (MASTER MANDATE — Cycle 37: reality-driven — ramble DATE proximity)** — Closes the second
  half of Leo's rambling-story failure. On the 0.116.0 preview (isolated per-scenario repro): #1 create
  resolved to גלעד ✓, story person+location ✓, but the DATE was still "היום" (grabbed from "דיברתי
  היום") instead of the meeting's "מחר בשלוש". Fix: `parseCreateDate` now, when MULTIPLE Hebrew day
  cues appear, picks the one NEAREST a time expression (a meeting's date + time are stated together) —
  a structural proximity rule, not a phrase list; a single cue is unchanged. Fixed a lookbehind bug
  (the ל/ב prefix in "להיום" is a Hebrew letter) that the device-transcript regression caught. Now the
  story resolves person=גלעד, location=בית קפה טולדנו, date=מחר — end-to-end. Evidence: CODE
  (calendarRelationPhrase story asserts date=מחר; realDeviceTranscriptRegression 32/32;
  calendarCrudGeneralization 4/4) + APP re-verify on a fresh preview; benchmark **100%**; FULL suite
  **11015 pass / 2 todo**; typecheck + build clean. NEXT: P4 generative marathon (thousands of full
  sessions through the app path); P2 full LLM semantic-extraction path (this proximity rule is a
  structural stopgap — the general answer is schema extraction of the full utterance).
- **0.116.0 (MASTER MANDATE — Cycle 36: reality-driven — relation-phrase person in create)** — New
  governing rule: only DEPLOYED-PREVIEW-through-the-app evidence counts. Reproduced Leo's 0.113.0
  device failures at APP level (Playwright on the live preview, `LEO_DEVICE_FAILURES_REPRO.json`):
  (#3 "מי גלעד עבור רפי" → "גלעד החתן של רפי." already WORKS at 0.115.0); (#1 create "עם החתן של רפי"
  → saved LITERALLY, RED); (#2 rambling story → location extracted OK, no verbatim dump, but person
  literal + date grabbed "היום" from "דיברתי היום" instead of the meeting's "מחר"). Fixed #1 + the
  person half of #2 with a GENERAL mechanism: new `personPhraseResolver` composes family-graph edges
  to resolve any relation phrase — blood AND in-laws (חתן/כלה/חם/חמות/גיס/גיסה) — to the real person
  ("החתן של רפי" → גלעד), unambiguous only, honest null on unknown/ambiguous. Wired into
  runCognitiveTurn's calendar_create (smart + base + story paths). Evidence: CODE (personPhraseResolver
  9/9 + calendarRelationPhrase 3/3, driven through the runtime) + APP-level RED repro; benchmark
  **100%**; FULL suite **11015 pass / 2 todo**; typecheck + build clean. NEXT: (a) re-verify #1 on a
  fresh preview through the app; (b) fix the story DATE bug (ramble grabs the wrong temporal cue —
  needs the meeting-verb-nearest cue or LLM extraction per P2); then the P4 generative marathon.
- **0.115.0 (Voice mission — Cycle 35: voice ↔ typed CONTROLLER PARITY for referability)** — First
  voice-mission cycle (text-layer-shared, no device claims). Mapped the voice handlers: both the
  pipeline-STT path and the Realtime path ALREADY route through the SAME
  ExecutiveCognitiveController + shared `cognitiveRuntimeStateRef` as typed (controller parity was
  in place). GAP: both voice paths pre-resolved pronouns via `resolvePronouns`/`resolveFollowUp`
  WITHOUT the calendar-focus guard added for text in 0.113.0 — so "תבטלי אותה"/"תעבירי אותה" spoken
  in voice would mis-resolve the pronoun to a gendered last-person (the exact referability bug fixed
  for typed). Applied the identical `hasCalFocus` guard to BOTH voice handlers (`vHasCalFocus`,
  `rtHasCalFocus`), so a referential pronoun stays RAW under a calendar focus and the runtime resolves
  it via `focus` — a fix in one modality now holds in the other (mandate rule). New
  `voiceReferabilityParity.test.ts` source-contract: all 3 input paths route through the controller,
  seed from the shared state, and guard the pronoun rewrite (4/4). Runtime behaviour already proven by
  calendarReferability + calendarCrudGeneralization (CODE). Physical voice audibility/latency stays
  PHYSICAL_DEVICE-only — NOT claimed. Evidence (CODE): voiceReferabilityParity 4/4; benchmark **100%**;
  FULL suite **11002 pass / 2 todo**; typecheck + build clean. NEXT (voice): device-gated audibility/
  latency pass (needs a real iPhone); barge-in/watchdog review.
- **0.114.0 (General Intelligence — Cycle 34: principle-C generated suites for dates + calendar)** —
  Backlog: closed the mandate's principle-C gap beyond family. `dateEngineGeneralization.test.ts` —
  ~1100 GENERATED date-arithmetic cases (בעוד/לפני N ימים·שבועות, relative-day words, +N hours,
  next-weekday) each checked against an INDEPENDENT JS-Date oracle: 6/6 green. `calendarCrud
  Generalization.test.ts` — ~440 GENERATED create/cancel/move sequences through the REAL runtime
  (`runCognitiveTurn`), asserting store state + referability incl. the pronoun forms "תבטלי אותה"/
  "תעבירי אותה": 4/4 green. Both are non-circular property proofs (parity with the 0.105.0 family
  generalization). Also PREVIEW-verified that math is DETERMINISTIC in-app (16/16 on the preview,
  incl. 3 math checks) and corrected the typed-test doc (math was mislabelled LLM from the old
  dead-code analysis). Evidence: CODE (2 new suites, ~1540 generated cases) + PREVIEW (math 3/3);
  benchmark **100%**; FULL suite **10998 pass / 2 todo**; typecheck + build clean. Voice/Realtime
  untouched. Backlog remaining: dead-code cleanup in index.tsx (0.112.0 no-op additions in the
  unreachable RUNTIME_OWNED block); create/confirm cutover; voice pass (deferred).
- **0.113.0 (General Intelligence — Cycle 33: PREVIEW-verified referability fix + real deploy proof)** —
  Ran the typed-test script against the DEPLOYED preview with Playwright (real browser, real build):
  12/13 at PREVIEW class — family (incl. in-law composition), dates, memory (save/recall/forget),
  calendar create/confirm all correct at ~350 ms. It CAUGHT a real bug local unit tests missed:
  "cancel it"/"where do I meet him" fell to the LLM. First-divergence: the pronoun was resolved to a
  person NAME across FOUR layers — UI `resolvePronouns`/`resolveFollowUp`/companion-continuity + the
  RUNTIME `normalizeInput` — and feminine "אותה" mis-resolved to a stale female name ("ארי"), ignoring
  the focused (male) event. Also discovered the live path is NOT the `RUNTIME_OWNED` block edited in
  0.112.0 (that is DEAD code): `COGNITIVE_RUNTIME_FULL=true` routes every turn through
  ExecutiveController→runFullTurn→runCognitiveTurn. Fixes (general): (1) the UI skips its pronoun/
  follow-up rewrite while a calendar event is in focus; (2) `runCognitiveTurn` keeps a referential-
  pronoun turn RAW under a calendar focus so `normalizeInput` no longer mis-resolves it; (3)
  `isFocusPropertyQuery` also binds a property question that NAMES the focus person. Result: the full
  create→where→move→cancel flow is deterministic (~330 ms) and **13/13 on the live preview**. Evidence:
  **PREVIEW** (Playwright on the deployed build, `docs/eval/PREVIEW_TYPED_SCRIPT_RESULTS.json`) + CODE
  (calendarReferability +2 regressions for the UI-resolved-name form); benchmark **100%**; FULL suite
  **10988 pass / 2 todo**; typecheck + build clean. Honesty correction: the 0.112.0 "cutover" edited
  dead code — the duplicate-handler REMOVAL was still valid, but the RUNTIME_OWNED/cogFocusRef additions
  are no-ops (kept, noted). Voice/Realtime untouched. NEXT: optional dead-code cleanup; math→runtime; C-class generated suites.
- **0.112.0 (General Intelligence — Cycle 32: UI CUTOVER — delete/modify + focus to the runtime)** —
  Closed the wiring gap found in 0.111.0. `index.tsx` now (a) adds `calendar_delete` + `calendar_update`
  to `RUNTIME_OWNED`, (b) persists the conversation `focus` across turns via a new `cogFocusRef` —
  threaded INTO the runtime state each turn, carried back OUT of every runtime-owned decision, and SET
  after a legacy save to the saved event's person — and (c) REMOVES the duplicate delete/modify handlers
  (and their now-unused imports). Result: referable reads ("איפה אני פוגשת אותו?") and pronoun mutations
  ("תבטלי אותה" / "תעבירי אותה ליום ראשון") now reach Martita in the app, with a human Hebrew date
  readback — one runtime path per capability (the mandate rule). Ordering verified safe: these turns
  already passed the free-speech advisory (they previously reached the duplicate handlers / the LLM), so
  routing them through the earlier runtime block does not newly intercept anything. Create/confirm stay
  on the legacy path (deliberate — the elaborate voice/pronoun/birthday-fusion flow is a later cutover).
  Also lowered a stale sanity bound in companionRuntimeGuard (fewer inline literals is the intended
  outcome of removing the duplicates; the real banned-phrase assertion is unchanged). Evidence
  (CODE + source-contract): calendarReferableMutation 7/7 (runtime behaviour + a cutover wiring
  contract on index.tsx); benchmark **100%**; FULL suite **10986 pass / 2 todo**; typecheck + build
  clean. **Live-app behaviour is PREVIEW-pending** (source-contract proves the wiring, not the
  end-to-end render). Updated docs/LEO_TYPED_TEST_SCRIPT.md (items 23a–23c moved from the gap to ✅
  RUNTIME). Voice/Realtime untouched. NEXT: fresh PREVIEW to confirm the flow end-to-end (needs a
  deploy trigger); optionally cut create/confirm over too.
- **0.111.0 (General Intelligence — Cycle 31: memory UI-wired + LEO typed test script + HONESTY finding)**
  — While preparing `docs/LEO_TYPED_TEST_SCRIPT.md` (~30 numbered bilingual typed checks, expected
  answers captured from the REAL runtime), a truth-audit of `index.tsx` surfaced a **wiring gap**: the
  deployed UI defers only 6 intents to `runCognitiveTurn` (`RUNTIME_OWNED`) and keeps DUPLICATE
  create/delete/modify handlers, and it rebuilds the runtime state each turn WITHOUT threading
  `focus`. Consequence (stated honestly, not hidden): cycles 26/28 (focus-dependent referable reads +
  pronoun "cancel it"/"move it") and — until now — 29/30 (memory) were CODE-proven but NOT reachable
  in the app; only cycle 27 (named-weekday read, calendar_read ∈ RUNTIME_OWNED) reached users. This
  is exactly the mandate's "one runtime path per capability" violation. LOW-RISK fix shipped now:
  added `memory` to `RUNTIME_OWNED` (a NEW intent with no duplicate handler, intercepted before the
  legacy path) → saved-memory turns now reach the runtime in the deployed UI (source-contract test).
  The typed-test doc labels every item by SOURCE (runtime / legacy-UI / LLM / online) and has a
  dedicated "Known wiring gap" section for the referable calendar turns. Evidence (CODE): savedMemory
  10/10; benchmark **100%**; FULL suite **10983 pass / 2 todo**; typecheck + build clean.
  NEXT (medium-risk, needs go-ahead): the UI CUTOVER — replace index.tsx's duplicate create/confirm/
  delete/modify handlers with `runCognitiveTurn` and PERSIST `focus` across turns, so referable reads
  + pronoun mutations reach Martita; then a fresh PREVIEW parity pass over the typed script.
- **0.110.0 (General Intelligence — Cycle 30: saved memories INJECTED into the LLM)** — RC5 mandate
  part B, completion. The durable saved memories (0.109.0) were answered deterministically but not yet
  available to open-ended chat. Now `formatSavedMemoriesForLLM(loadMemories())` builds a labelled
  system block that is pushed into the general-chat LLM context at BOTH `service.ts` build sites (the
  streaming `chatMessages` and the tool-call `conversationMessages`), right after the existing
  `ConversationSummary` injection — so an open question ("what would be a good gift for me?") can use
  "she loves red wine". Empty block when nothing is stored; it is real grounding (things she asked to
  remember), so the honesty/no-fabrication rules are unchanged. Evidence (CODE): savedMemory 9/9
  (formatter unit + a BOTH-site source-contract on service.ts); benchmark floor **100%**; FULL suite
  **10982 pass / 2 todo**; typecheck + build clean. Voice/Realtime untouched. Memory (mandate part B)
  is now complete at CODE level: saved facts (store/recall/forget, privacy-filtered, He+Es, injected)
  + the pre-existing cross-session summary. NEXT: fresh PREVIEW parity milestone across the calendar +
  memory flows (needs a deploy trigger).
- **0.109.0 (General Intelligence — Cycle 29: SAVED MEMORY — durable user-commanded facts)** — RC5
  mandate part B (memory). Discovery first (reuse, don't rebuild): the passive rolling
  `ConversationSummary` (service.ts) already persists + injects into the LLM, and `durableStore`
  (IndexedDB + mirror) is the persistence layer — but there was NO explicit user-COMMANDED memory:
  "תזכרי ש…" fell to the LLM, which is told it has no store, so nothing was ever truly saved. New
  `savedMemory.ts` (durable-backed) + a `memory` runtime intent: "תזכרי ש<fact>" persists, "מה את
  זוכרת עליי?" recalls, "תשכחי ש…" forgets — He + Es (recordá que / qué te acordás de mí / olvidate).
  PRIVACY enforced at the write boundary (phone/medical/financial/street refused, never stored). The
  "ש"/"que" complementizer is required so a reminder ("תזכירי לי לקנות חלב") is NOT captured. Proven
  by MULTI-SESSION replays through the single runtime: session A stores → a FRESH IDLE_RUNTIME session
  B recalls (the fact lives in durable, not RuntimeState) → C forgets; + privacy refusal + multi-fact
  + Spanish + reminder-not-captured. Evidence (CODE): `savedMemory.test.ts` 7/7; benchmark floor
  **100%**; FULL suite **10980 pass / 2 todo**; typecheck + build clean. Voice/Realtime untouched.
  NEXT: inject saved memories into the general-chat LLM system context (so open questions use them,
  like the summary does) with a source-contract test; consider "what do you remember" surfacing in
  the UI. Then: preview parity milestone.
- **0.108.0 (General Intelligence — Cycle 28: referable MUTATION — "cancel it" / friendly date)** —
  RC5 mandate cycle 4, completes the referable-CRUD flow. Two real bugs found by driving a TWO-event
  store through `runCognitiveTurn`: (1) "**תבטלי אותה**" / "cancel it" (a pronoun cancel with NO noun)
  classified as `general` → needsLLM → DISPLAY=null, event NOT deleted — the mandate's exact "cancel
  it" dead-ended to the LLM (`isDeleteIntent` only matches noun forms). (2) the UPDATE readback printed
  raw ISO ("ל-2026-06-28"). Fixes: `isReferentialDelete` (cancel/delete verb + pronoun/bare, anchored),
  gated on a live `calendar_event` FOCUS, routes to `calendar_delete` in classifyIntent AND broadens
  `deletePlugin.match` (else the plugin re-check would still drop it); delete/modify now resolve the
  target via the focused event (person) with last-appointment fallback; `modifyReasoner` readback uses
  `formatHebrewDate` → "28 ביוני 2026, יום ראשון". Additive/guarded — the referential path only fires
  with a focus; explicit-name and last-event paths unchanged. Evidence (CODE):
  `calendarReferableMutation.test.ts` 4/4 (red→green: cancel-it single, move→friendly-date + right
  referent, cancel-it after move keeps רפי, cancel-the-last-meeting) through the runtime + real store;
  benchmark floor **100%**; FULL suite **10972 pass / 2 todo**; typecheck + build clean. Voice/Realtime
  untouched. The referable-CRUD flow (create→where→move→read→cancel, He) is now GREEN end-to-end at
  CODE level. NEXT: take a fresh PREVIEW and spot-check the flow (mandate: preview parity at
  milestones); then persistent memory (saved facts + cross-session summaries).
- **0.107.0 (General Intelligence — Cycle 27: named-weekday calendar READ)** — RC5 mandate cycle 3,
  same referable-CRUD flow, divergence #3. "מה יש לי ביום חמישי?" answered "אין כלום ביומן ליום הזה"
  — confidently WRONG, because `calendarReadReasoner` parsed only היום/מחר/מחרתיים/השבוע and otherwise
  read TODAY; the event sat on Thursday. A read that HIDES a real event is a dead-end (mandate
  principle B). Fix: resolve a named weekday ("ביום חמישי", "בשבת") to its NEXT occurrence (today if
  today is that weekday) via the existing `HE_WEEKDAY_IDX` and read THAT day; honest empty
  ("ביום שישי אין כלום") preserved. Scoped to the read reasoner; other reads unchanged. Evidence
  (CODE): `calendarNamedWeekdayRead.test.ts` 2/2 (red→green) + calendarReferability 6/6, both
  multi-turn through `runCognitiveTurn` + real store; benchmark floor **100%**; FULL suite **10968
  pass / 2 todo**; typecheck + build clean. Voice/Realtime untouched. NEXT (last divergence in this
  flow): update readback prints raw ISO ("ל-2026-06-25") — compose a friendly Hebrew date — and
  "move it" should resolve the target via FOCUS, not the last-appointment heuristic (matters once >1
  event exists). Then: persistent memory (saved facts + cross-session summaries).
- **0.106.0 (General Intelligence — Cycle 26: calendar REFERABILITY, pronoun→focus)** — RC5 mandate
  cycle 2 (Leo picked calendar CRUD referability). Drove the mandate's exact flow through the single
  runtime (`runCognitiveTurn`, mechanism-first) — create "פגישה עם רפי מחר בשלוש בבית קפה מרוקו" → "כן"
  (saved, focus=רפי) → "**איפה אני פוגשת אותו?**" → the FIRST divergence: the pronoun property
  question classified as `general` → needsLLM, DISPLAY=null, even with the event in focus — a FALSE
  dead-end (the store CAN answer). ROOT fix (general, not a phrase list): a focus-property detector
  `isFocusPropertyQuery` = property-CUE + focus-REFERENCE (pronoun אותו/אותה/איתו/זה or the noun
  "פגישה") + NO other named person; it broadens the bare-form `CAL_PROPERTY_RE` gate so "איפה אני
  פוגשת אותו?"/"עם מי הפגישה?"/"מתי אני נפגשת איתו?" read from the focused event. Leading "ו" stripped
  for chained follow-ups ("ובאיזו שעה?"); `answerCalendarProperty` now also answers "מתי" (date+time).
  Additive — fires only with a live `calendar_event` focus; a DIFFERENTLY-named person still
  re-searches (guard test). Evidence (CODE): `calendarReferability.test.ts` 6/6 (red→green, multi-turn
  through the runtime + real store round-trip); benchmark floor **100%**; FULL suite **10966 pass /
  2 todo**; typecheck + build clean. Voice/Realtime untouched (text-only). NEXT (same flow, remaining
  divergences): (2) named-weekday READ — "מה יש לי ביום חמישי?" says "אין כלום" though the event is
  on Thursday (`calendarReadReasoner` parses only היום/מחר/מחרתיים/השבוע); (3) update readback shows
  raw ISO "ל-2026-06-25" instead of a friendly Hebrew date, and "move it" should resolve the target
  via FOCUS, not the last-appointment heuristic. Then: persistent memory.
- **0.105.0 (General Intelligence — Cycle 25: in-law by COMPOSITION, not patterns)** — RC5 mandate
  cycle 1. Built a property-based GENERALIZATION proof for the family relation engine
  (`familyRelationGeneralization.test.ts`): generates ALL 240 real person-pairs from
  `family_graph.json` edges and asserts, via an INDEPENDENT in-test edge oracle, that
  `describeRelation` resolves every graph-derivable pair with no false dead-end, correct gender,
  and He/Es/En parity + symmetry — it passed (family engine genuinely generalizes for its supported
  classes). Probing the mandate's named flows then found the honest RED: the DIRECTIONAL engine
  (`relationOf`) dead-ended ("לא יודעת") on in-laws needing marriage + a MULTI-hop blood relation —
  Yarden↔Noam (wife of a cousin), Gilad↔Leo (husband of a niece), Yarden↔Martita (wife of a
  grandson) — even though the chain IS in the graph (a false dead-end, mandate principle B). ROOT
  fix is GENERAL, not a pattern list: added ONE composition rule — an in-law = the spouse of any
  blood relative OR the blood relative of any spouse, at ANY depth — built on the existing blood
  algebra (`bloodRelationKind`), both marriage directions, He+Es, gender-correct. Additive: runs
  only after the named ladder falls through, so no named relation regresses. Evidence (CODE):
  RED-first `familyInLawComposition.test.ts` 11/11 (red→green, stash-implied by additive guard);
  generalization proof 6/6; inverse-consistency property 4/4 (in_law is self-inverse, BFS path
  exists); benchmark floor **100%** held; FULL suite **10960 pass / 2 todo**; typecheck + build
  clean. Voice/Realtime untouched (text-only per mandate). NEXT (backlog): (a) unify the three
  family engines onto ONE path (`answerFamilyRelation`/`relationOf`/`describeRelation` overlap —
  mandate "one runtime path per capability"); (b) mirror composition into `describeRelation` +
  extend the generalization proof to assert composed pairs; (c) calendar CRUD referability
  ("cancel the last meeting" / "move it to Thursday"); (d) persistent memory (saved facts +
  cross-session summaries) — currently absent by design.
- **0.102.0 (Intelligence Parity — Cycle 23: grandchildren-of-X + family-data verify)** — First
  VERIFIED against knowledge/family_data.json that "בן הזוג של מור → יעל" is CORRECT (Yael is
  Mor's partner) — NOT a wrong-person bug. Then fixed the real gap: "מי הנכדים של X" fell to the
  LLM (routing matched singular נכד/נכדה, not plural נכדים/נכדות; no grandchildren-of-X rule).
  Added grandchildren REL rule (grandchildrenOfPublic) + plural routing. "מי הנכדים של מור" →
  אנאבל, ארי; "מי הנכדים של לאו" → honest (none), never fabricated. Evidence:
  grandchildrenOfX.test.ts 3/3 green; family suites 256 green; full suite 10925 green; typecheck
  + build clean. NEXT (backlog): days-until-end-of-month; Spanish "recordame"; recurring reminder;
  "בעצם לא" misroute; (low) gis/sibling-in-law.
- **0.101.0 (Intelligence Parity — Cycle 22: unit conversions)** — Everyday unit conversions
  ("3 קילומטר במטרים", "חצי קילו בגרם", "30 מעלות צלזיוס בפרנהייט") fell to the LLM. Extended
  mathReasoner with convertUnits: length (km/m/cm), mass (kg/g), volume (l/ml) via fixed
  factors + same-dimension check, temp C↔F via the real formula, He word quantities
  (חצי/רבע/שלושת רבעי). Fixed a substring collision — "קילו" inside "קילומטר" matched the kg
  unit (kg now uses קילו(?!מטר)) so "3 קילומטר במטרים" → 3000, not a km→kg dimension error.
  Price/mismatched-units → null → still online. Evidence: unitConversion.test.ts 7/7 +
  mathReasoner.test.ts 8/8 green; calendar+online suites 309 green; full suite 10922 green;
  typecheck + build clean. NEXT (backlog): days-until-end-of-month; family grandchildren/in-law
  + verify "בן הזוג של מור→יעל"; Spanish "recordame"; recurring reminder; "בעצם לא" misroute.
- **0.100.0 (Intelligence Parity — Cycle 21: backward date arithmetic)** — "איזה יום היה
  לפני שבוע?" fell to the LLM; dateReasoner did FORWARD ("בעוד") but not BACKWARD arithmetic.
  Added lifneiDaysOffset (לפני N ימים/יומיים/שבוע/שבועיים/N שבועות) + extended
  RELATIVE_DATE_QUERY_RE to route "לפני" to date_query. "לפני שבוע" → יום רביעי 8 ביולי;
  "לפני יומיים" → יום שני 13 ביולי. Forward unchanged. Evidence: backwardDate.test.ts 5/5
  green; date suites 122 green; full suite 10915 green; typecheck + build clean. (0.100 =
  0.x foundation sequence, not a 1.0 GA.) NEXT (backlog): days-until-end-of-month; unit
  conversions; family grandchildren/in-law + verify "בן הזוג של מור→יעל"; Spanish "recordame".
- **0.99.0 (Intelligence Parity — Cycle 20: time-in-city / timezone)** — Wide-probe
  confidently-wrong bug: "מה השעה בניו יורק?" returned the LOCAL Israel clock (10:00) instead
  of New York time — the TIME branch ignored the city. Added CITY_TZ (NY, Buenos Aires/
  Argentina, London, Paris, Madrid, Barcelona, LA, Miami, Moscow, Berlin, Rome, Tokyo, Sydney,
  Dubai; He+Es names) + timeInCity via Intl.DateTimeFormat({timeZone}) — deterministic
  regardless of runner TZ. Unknown cities fall through to local honestly; bare "מה השעה"
  unchanged. Evidence: timeInCity.test.ts 5/5 green; date+time suites 50 green; full suite
  10910 green; typecheck + build clean. NEXT (backlog): backward date "לפני שבוע"; days-until-
  end-of-month; unit conversions; family grandchildren/in-law + verify "בן הזוג של מור→יעל";
  Spanish "recordame"; recurring reminder; "בעצם לא" misroute.
- **0.98.0 (Intelligence Parity — Cycle 19: math calculator + wide-probe triage)** — Ran a
  FAR wider adversarial probe (all of life). Fixed the highest-value deterministic gap: everyday
  arithmetic ("כמה זה 15 כפול 4", "20 אחוז מ-200", "15 אחוז טיפ על 240 שקל") fell to the LLM
  (unreliable at math). Added deterministic mathReasoner (×÷+− word/× ÷ symbols, percent-of,
  percent-tip w/ total, He+Es) + new `math` intent routed before online; isMathQuery matches
  only real expressions (price "כמה עולה חלב" still online), ASCII +-*/ excluded so times/ratios
  are never mis-read. Evidence: mathReasoner.test.ts 8/8 green; math+calendar+online suites 333
  green; full suite 10905 green; typecheck + build clean. TRIAGED BACKLOG (in gap map): timezone
  "מה השעה בניו יורק" (wrong), backward date "לפני שבוע", days-until-end-of-month, unit
  conversions, family grandchildren/in-law, Spanish reminder "recordame", recurring reminder,
  "בעצם לא" misroute, zmanim/parsha→online. LLM-legit: translations/definitions/emotional/chitchat.
  NEXT: timezone or unit conversions or backward-date.
- **0.97.0 (Intelligence Parity — Cycle 18: Spanish meal-create)** — "agendá una cena con
  Anabel el viernes a las ocho" fell to the LLM while "anotá una cita …" works —
  CREATE_INTENT_ES recognized cita/reunión/turno/evento but not meal nouns; and a bare "a las
  ocho" for a cena defaulted to 08:00 (an 8 AM dinner, the Spanish twin of the C4 bug). Added
  cena/almuerzo/comida/desayuno/café/merienda to the Spanish schedulable objects + cena/
  almuerzo/merienda → PM (desayuno → AM) meal-context period. Now → calendar_create with
  Anabel, viernes, 20:00. Evidence: spanishDinnerCreate.test.ts 3/3 green; Spanish + calendar
  suites 111 green; full suite 10897 green; typecheck + build clean. NEXT (backlog): deterministic
  math/units calculator; age queries; else re-probe. Cannot close in text: LIVE online grounding.
- **0.96.0 (Intelligence Parity — Cycle 17: next-weekday)** — Widened the probe corpus
  (Spanish create, next-weekday, age, math/units, translations, emotional). Confidently-wrong
  gap: "איזה תאריך יום שלישי הבא?" matched date_query → returned TODAY; "מתי יום ראשון הבא?"
  → LLM. Added nextWeekdayAnswer (next occurrence of a weekday, strictly after today) +
  NEXT_WEEKDAY_QUERY_RE (date-asking frame so a create is not hijacked). Fixed a latent ASCII
  word-boundary bug in the frame regex (the מתי forms had silently gone to the LLM). Evidence:
  nextWeekday.test.ts 5/5 green; date+calendar suites 117 green; full suite 10894 green;
  typecheck + build clean. Widened-probe backlog (mostly LLM-legitimate): Spanish create
  "cena" (dinner) → LLM; math/units; age. General knowledge/translations/emotional = LLM's
  job (no fix). NEXT: Spanish create "cena", or a deterministic calculator for math/units.
- **0.95.0 (Intelligence Parity — Cycle 16: memory honesty + last-question recall)** — Two
  device failures. (1) "implied it had memory while having none": a CROSS-SESSION memory
  question ("את זוכרת מה אמרתי לך אתמול?" / "¿te acordás … ayer?") now gets a deterministic
  HONEST reply that never implies past-session memory (CROSS_SESSION_MEMORY_RE requires a
  past-session time marker, so within-session "מה אמרתי קודם" is untouched). (2) "what was my
  last question": "מה שאלתי אותך קודם?" / "¿qué te pregunté?" recalls the prior user question
  from this session (raw message history → last recorded question → honest nothing-yet), never
  the LLM. Both handled in the continuation case; RECALL_TOPIC + resume unaffected. Evidence:
  memoryHonestyRecall.test.ts 4/4 green; continuation suites 515 green; full suite 10889 green;
  typecheck + build clean. The device-failures triage backlog is now cleared in text — remaining
  is LIVE online grounding (PREVIEW-class). NEXT: widen the probe corpus for new gaps.
- **0.94.0 (Intelligence Parity — Cycle 15: civic-holiday online)** — Device failure: wrong
  Independence Day (gave 2024 / a past date). National/civic days (יום העצמאות/חג העצמאות,
  יום הזיכרון, יום השואה, יום ירושלים, Spanish día de la independencia) are NOT in the
  deterministic religious-holiday table and their Gregorian date is nidche-adjusted — so
  hardcoding/computing would risk INVENTING a wrong date. Two RED cases: "באיזה תאריך יום
  העצמאות" matched date_query → returned TODAY (confidently wrong); "מתי חג העצמאות" / Spanish
  → LLM. Added CIVIC_HOLIDAY_RE routed to LIVE retrieval BEFORE date_query + before the LLM
  fallback; religious holidays (ראש השנה/פסח) + relative dates (אתמול) not hijacked. Evidence:
  civicHolidayOnline.test.ts 7/7 green; date+online suites 70 green; full suite 10885 green;
  typecheck + build clean. DECISION: exact date left to the LIVE provider (PREVIEW-class);
  nidche computation intentionally NOT hardcoded to avoid inventing dates. NEXT: Cycle 16 —
  memory honesty (never imply cross-session memory) + last-question recall.
- **0.93.0 (Intelligence Parity — Cycle 14: top-scorer online)** — Device failures: "who is
  the top scorer" not answered, and "ומי מלך השערים?" after a sports answer fell to the LLM.
  The sports online detector required explicit context (מונדיאל/כדורגל) and didn't recognize
  "מלך השערים"/"מי הבקיע" on their own. Added them to ONLINE_HE_SPORTS → standalone AND
  follow-up top-scorer routes online (live retrieval, not model memory). Evidence:
  topScorerOnline.test.ts 3/3 green; online suites 116 green; full suite 10878 green;
  typecheck + build clean. NOTE: whether the LIVE provider returns a correct scorer is
  PREVIEW-class. NEXT (device backlog): 15 Independence/memorial deterministic dates, 16
  memory honesty + last-question recall.
- **0.92.0 (Intelligence Parity — Cycle 13: Spanish relation-between)** — "¿qué relación hay
  entre Anabel y Leo?" fell to the LLM though the Hebrew resolves deterministically. Made the
  directional kinship engine bilingual: Spanish label map (LABEL_ES, every RelationKind),
  lang param on relationOf rendering es with the canonical Latin name ("Mor es madre de
  Ofir"), Spanish parsing (relación entre X y Y / qué es X para Y), + routing. Also fixed a
  latent bug: relationOf now resolves Latin/alias names via findNode (its local matchNames
  index lacked them). Evidence: spanishRelationBetween.test.ts 3/3 green; family suites 66
  green; full suite 10875 green; typecheck + build clean. NEXT (device backlog): 14 online
  follow-up continuity, 15 Independence/memorial deterministic dates, 16 memory honesty +
  last-question recall.
- **0.91.0 (Intelligence Parity — Cycle 12: calendar midnight / device failure)** — Built a
  device-failures triage (deviceFailuresTriage.test.ts) reproducing Leo's exact observed
  failures. Confirmed FIXED: "פגישה עם אופיר מחר בחצות בקפה אילנה" asked "באיזו שעה" even
  though "בחצות" was said, and the no-verb form fell to the LLM. parseHebrewTimeDetailed did
  not resolve בחצות + it was not a narrative time-cue. Added בחצות/חצות/חצות הלילה → 00:00,
  חצות היום → 12:00, and בחצות to TIME_CUE. Now → calendar_create with person=אופיר,
  place=קפה אילנה, time=00:00, no re-ask (± create verb). Evidence: calendarMidnight.test.ts
  4/4 green; calendar suites 130 green; full suite 10872 green; typecheck + build clean.
  Triage ranked the remaining device-failure backlog: 13 Spanish relation-between, 14 online
  follow-up continuity, 15 Independence/memorial deterministic dates, 16 memory honesty +
  last-question recall.
- **0.90.0 (Intelligence Parity — Cycle 11: mid-create person correction)** — After
  "תקבעי פגישה עם דני …", "לא, לא עם דני, עם מור" fell to the LLM — the pending-create engines
  had no PERSON-correction path (only date/time), so a companion swap with no date/time hit
  the off-topic guard and parked as a side question (a later "כן" would save the STALE person).
  Traced the live path to conversationV2 (classifySignalV2/reduceV2 — NOT resolvePendingMessage).
  Fixed there (PERSON_CORRECTION_RE → field_answer → update) AND in the shared updateCreate
  (swap companion + rewrite title while confirming). "לא, לא עם דני, עם מור" → פגישה עם מור;
  "כן" saves מור. Evidence: createPersonCorrection.test.ts 2/2 green; calendar + V2 suites 329
  green; full suite 10867 green; typecheck + build clean. NEXT (probe-2 backlog): Spanish
  family-relation ("la hija de X") + Spanish create ("agendá una cena…"); next-weekday.
- **0.89.0 (Intelligence Parity — Cycle 10: family siblings)** — Probe-2 gap FAM-SIB:
  "מי אח/אחות של X" returned the unknown fallback (no sibling rule), though לאו is מור's
  brother. Added siblingsByGenderPublic (other children of the parents, gender-filtered) +
  brother/sister/plural REL rules: "מי אח של מור" → לאו, "מי אחות של לאו" → מור; no
  fabrication when there is no sibling of that gender. Evidence: familySiblings.test.ts 3/3
  green; family suites 56 green; full suite 10865 green; typecheck + build clean. NEXT
  (probe-2 backlog): mid-create PERSON change, Spanish family-relation/create, next-weekday.
- **0.88.0 (Intelligence Parity — Cycle 9: relative date/time arithmetic)** — Expanded the
  probe corpus (intelligenceGapProbe2, harder scenarios) to surface new gaps once the ranked
  list was exhausted. Found: dateReasoner did fixed offset WORDS but not ARITHMETIC —
  "בעוד שלושה ימים" → TODAY (confidently wrong), "בעוד שבוע" → LLM, "מה השעה בעוד שעתיים" →
  10:00 (not 12:00). Added beodDaysOffset + beodHoursOffset (deterministic from ctx.now) +
  routing. "בעוד שלושה ימים" → 18 ביולי; "מה השעה בעוד שעתיים" → 12:00. Evidence:
  relativeDateArithmetic.test.ts 6/6 green; date suites 31 green; full suite 10862 green;
  typecheck + build clean. NEXT (from probe 2): siblings ("מי אח של מור"), mid-create PERSON
  change, Spanish family-relation/create. LIVE online grounding remains PREVIEW-class.
- **0.87.0 (Intelligence Parity — Cycle 8: clinic location capture / C5)** — "תקבעי פגישה
  עם הרופא מחר בבוקר בקופת חולים בכפר סבא בתשע" captured the location as only "כפר סבא" —
  "קופת חולים" (the HMO clinic, the real venue) was dropped because it was not a venue
  head-word, so the extractor fell to the bare-city match. Added קופת חולים (+ קופ"ח/קופ״ח)
  to VENUE_HEAD → location "קופת חולים בכפר סבא", and the time (בתשע) never leaks in.
  Evidence: clinicLocationCapture.test.ts 2/2 green (extractor + real controller); extractor
  + calendar suites 125 green; full suite 10855 green; typecheck + build clean. Calendar
  drafting gaps (C1–C5) now closed; meal-noun TITLE remains (low sev). NEXT: re-probe for
  new gaps / add fresh scenarios; the remaining big item (LIVE online grounding) is PREVIEW-class.
- **0.86.0 (Intelligence Parity — Cycle 7: meal time-of-day / C4)** — "קבעי ארוחת ערב עם
  אנבל ביום שישי בשמונה" scheduled an 8 AM dinner: the bare hour "בשמונה" was ambiguous and
  defaulted to the morning reading because "ארוחת ערב" (dinner) was not a period hint
  (PERIOD_PM matched only "בערב", not the bare meal noun). Added meal-context hints
  (ארוחת ערב/צהריים/דינר → PM, ארוחת בוקר → AM), so dinner → 20:00; a truly bare hour with
  no meal/period context stays ambiguous (unchanged). Also fixes a latent bug: "ארוחת בוקר
  בשש" no longer flips to 18:00. Evidence: mealTimeOfDay.test.ts 4/4 green; calendar suites
  150 green; full suite 10853 green; typecheck + build clean. Remaining (low sev): meal-noun
  TITLE ("ארוחת ערב עם אנבל" vs "פגישה עם אנבל"). NEXT: title polish, or re-probe for new gaps.
- **0.85.0 (Intelligence Parity — Cycle 6: ONLINE cache-collapse)** — Root cause of the
  "repeated identical answers to different questions" symptom, FOUND + FIXED in CODE. The
  provider cache (answerOnlineCurrentInfo) keyed by the COARSE queryKind (general_current /
  news / sports), so two different same-kind questions within the 30-min TTL returned the
  same cached answer ("מי ראש הממשלה" vs "מי נשיא ארה\"ב" both → general_current). Fixed to
  key by kind + specific query — identical repeats still cached, different questions never
  share. Separately proved the ExecutiveCognitiveController online ROUTING is already clean
  (onlineStaleAnswerProbe: 2 consecutive different online turns each get their own answer).
  Evidence: onlineCacheCollapse.test.ts 2/2 + onlineProvider.test.ts + probe green; full
  suite 10849 green; typecheck + build clean. REMAINING (PREVIEW-class, not CODE): end-to-end
  live grounding needs a real provider call. NEXT: re-run the broad probe for any new gaps;
  otherwise the text-provable intelligence set is substantially covered.
- **0.84.0 (Intelligence Parity — Cycle 5: FAMILY count queries / F6)** — "כמה נכדים/
  ילדים/נינים יש ל<X>" punted to the LLM (no count reasoner; single family name so routing
  never reached the graph). Added familyCountReasoner (grandchildrenOfPublic /
  greatGrandchildrenOfPublic / childrenOfPublic) + routing: "כמה נכדים יש למרטיטה" → "יש
  למרטיטה 6 נכדים: אופיר, איילון, עילי, אדר, עדי ונועם"; "כמה נכדים יש לי" → "לך". Evidence:
  `familyCountQueries.test.ts` 4/4 green; family suites 246 green; full suite 10846 green;
  typecheck + build clean. Family cycle complete in text (F1–F6, M2 all closed). NEXT:
  Cycle 6 — ONLINE provider-boundary stale-answer reproduction (PREVIEW class, needs live provider).
- **0.83.0 (Intelligence Parity — Cycle 4: FAMILY parent + pronoun continuity / M2)** —
  Closes M2. (1) Singular "מי אמא/אבא של X" punted to the LLM (no parent rule) → added
  gender-filtered mother/father rules (parentsByGenderPublic); "מי אמא של אופיר" → מור.
  (2) A follow-up pronoun had no antecedent: after "מי זה אופיר", "ומי אמא שלה?" returned
  the unknown fallback → added working-memory antecedent (lastFamilySubject) +
  resolveFamilyPronoun, rewriting שלה/שלו/שלהם to the last-discussed person, so
  "ומי אמא שלה" → "מי אמא של אופיר" → מור. Evidence: `familyPronounContinuity.test.ts`
  2/2 green (real 2-turn conversation); family + continuity suites 66 green; full suite
  10842 green; typecheck + build clean. NEXT: Cycle 5 — F6 grandchild-count queries, then
  ONLINE provider-boundary stale-answer repro (PREVIEW class).
- **0.82.0 (Intelligence Parity — Cycle 3: FAMILY parity)** — Two family-graph
  parity gaps. (1) Singular "מי הבת/הבן של X" punted to the LLM (engine knew only PLURAL
  children) → added gender-filtered daughter/son rules; "מי הבת של מרטיטה" → מור, "מי הבן
  של מרטיטה" → לאו. (2) Spanish "¿quién es X?" returned the unknown fallback — the resolver
  regex was ^-anchored and the leading ¿ broke it (Hebrew "מי זה X" worked) → tolerate ¿/?
  + render Spanish ("Abu es abuela de Ofir a través de Mor"). Evidence:
  `familyDaughterSonSpanish.test.ts` 4/4 green; family regression suites 62 green; full
  suite 10840 green; typecheck + build clean. DEFERRED (noted in gap map): F6 grandchild
  count, M2 pronoun continuity. NEXT: Cycle 4 — M2 continuity ("ומי אמא שלה?") or F6 counts.
- **0.81.0 (Intelligence Parity — Cycle 2: CONVERSATION QUALITY / Q2)** — First
  divergence: `WHY_RE` began with `^למה(?![א-ת])`, matching ANY "למה <x>" — so an
  innocent knowledge question ("למה השמיים כחולים", why is the sky blue) was routed to a
  frustration CHALLENGE reply (apology "לא הייתי מספיק ברורה") instead of being answered.
  FIX: narrowed WHY_RE to bare "למה?" + specific challenge phrasings (למה לא קבעת /
  למה אין לך / למה אצלך); "why <topic>" now reaches general/LLM. Evidence:
  `whyKnowledgeVsChallenge.test.ts` 5/5 green (real controller + predicate); targeted
  challenge suites 318 green; full suite 10836 green; typecheck + build clean. NEXT:
  Cycle 3 — FAMILY (Spanish "¿quién es Ofir?" fails, "her mother" continuity, graph counts).
- **0.80.0 (Intelligence Parity — Cycle 1: DATE/TIME)** — Drove the real
  ExecutiveCognitiveController.handleTurn over a broad He+Es+mixed corpus
  (`src/eval/intelligenceGapProbe.test.ts`, text-only, no mic) → built
  `docs/INTELLIGENCE_GAP_MAP.md`. First divergence: `dateReasoner` always answered
  with `now`, and `DATE_QUERY_RE` only matched today/date phrasings — so
  "איזה תאריך היה אתמול" returned TODAY (confidently WRONG), relative-day questions
  fell to the LLM (no clock), and "מתי החג הבא" hallucinated (Independence-Day
  incident class). FIX: relative-offset (אתמול/שלשום/מחר/מחרתיים + Spanish ayer/mañana)
  + next-holiday reasoner (fixed table) resolved DETERMINISTICALLY from ctx.now; new
  RELATIVE_DATE_QUERY_RE + HOLIDAY_QUERY_RE route to date_query without touching the
  calendar read path. Evidence: `relativeDateReasoning.test.ts` 8/8 green (CODE);
  full suite 10831 green (was 10823 pre-probe/regression), typecheck + build clean.
  Calendar core create→confirm→save→readback→correction re-verified working in text
  (a prior "לא נשמרה" was a node-env artifact, not a bug). NEXT: Cycle 2 — "למה השמיים
  כחולים" misrouted to frustration (knowledge Q hijacked by the why-challenge classifier).
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
