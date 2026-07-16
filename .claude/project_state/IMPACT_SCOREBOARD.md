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
