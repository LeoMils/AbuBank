# AbuAI — Production Acceptance Board

**The single durable acceptance truth.** A capability is only as green as its WEAKEST honest
evidence class for the experience Martita actually has. Passing unit tests are `CODE` evidence —
they do NOT turn a row green. Real device/production evidence overrides any number of mocks.

**Stamp:** build `0.70.0-spanish-create-stays-spanish` · branch `rc5/cognitive-architecture-and-acceptance`
· updated 2026-07-14 (recovery cycles: 0.64.0 durable-flush-on-hide, 0.65.0 current-info-grounding,
0.66.0 fragmented-create-continuity, 0.67.0 natural-slotfill-clarify, 0.68.0 fragment-ambiguous-hour-parity,
0.69.0 spanish-transcript-locale-integrity, 0.70.0 spanish-create-stays-spanish). Earlier baseline: `0.63.0`
/ commit `090b54b` (pre-FR1, 2026-07-12).
Schema: `src/engineering-os/evidence.ts`. Classes: `CODE < MOCK < BROWSER < PREVIEW < PHYSICAL_DEVICE < PRODUCTION`.
**Reviewed 2026-08-11 at build `0.202.0-abuela-online-winner-m2`:** no device retest this cycle — the RED/
YELLOW device rows are UNCHANGED (still blocked on Leo's iPhone). The only movement is the **Online** row's
"real grounded retrieval" sub-blocker → **PREVIEW** (real keyed Tavily win, wired, honesty gate proven; see
its detail). Full unit suite green (12354). Everything else here remains as stamped.

> ⚠️ This board is intentionally NOT optimistic. Most rows are RED/YELLOW because physical
> acceptance failed. Nothing here was made green by this Foundation task (no product code changed).

## Legend
`✓` proven at this class · `~` partial/observed-once · `✗` failed at this class · `–` not attempted/NA.
Status: 🟢 accepted · 🟡 partial (works at a weaker class, unproven at the class acceptance needs) · 🔴 failing/not accepted.

## Board

| Capability | CODE | MOCK | BROWSER | PREVIEW | DEVICE | PROD | Status |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Voice (loop) | ✓ | ✓ | ~ | – | ✗ | – | 🔴 |
| STT | ✓ | ✓ | ~ | – | ✗ | – | 🔴 |
| TTS | ✓ | ✓ | ✓ | – | ✗ | – | 🟡 |
| Online (current info) | ✓ | ✓ | ~ | ~ | ✗ | – | 🔴 |
| Calendar (write/read/modify) | ✓ | ✓ | ~ | – | ✗ | – | 🔴 |
| Working Memory | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Persistent Memory | ✓ | ✓ | – | – | ~ | – | 🟡 |
| Family Graph | ✓ | ✓ | – | – | ~ | – | 🟡 |
| Follow-up | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Correction Handling | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Grounding (residence≠live loc.) | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Natural Conversation | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Latency (~20s observed) | ~ | ✓ | ~ | – | ✗ | – | 🔴 |
| Mobile / PWA | ✓ | ✓ | ✓ | ~ | ~ | – | 🟡 |
| Privacy (keys/PII) | ✓ | ✓ | – | – | – | – | 🟢 (CODE) |
| Diagnostics | ✓ | ✓ | ~ | – | ~ | – | 🟡 |

## Detail (last evidence · first divergence · blocker · next acceptance action)

- **Voice 🔴** — Software playback + fallback proven at BROWSER; `REALTIME_AUDIO_TIMEOUT` watchdog
  added (0.63.0). *First divergence:* physical iPhone mic capture / audible warmth / on-device
  latency unproven. *Blocker:* P0-DEVICE + P0-REALTIME (device-only). *Next:* run
  `docs/abuai/LEO_COMPANION_BREAKTHROUGH_RETEST.md` on a physical iPhone; record `PHYSICAL_DEVICE` evidence.
  **DEVICE finding (0.74.0, root-caused in `docs/DEVICE_P0_ROOT_CAUSE.md`):** mic tap → "מקשיבה..."
  forever, zero audio in/out. Code audit: primary STT is `webkitSpeechRecognition` (unreliable in iOS
  PWA standalone) and the Web Speech listening path has **no watchdog** — if `onend` never fires it hangs
  forever (a bounded-fallback defect per `.claude/rules/voice.md`). Recorder mime is iOS-aware and
  `VITE_GROQ_API_KEY` is present, so the Whisper fallback path is viable.
  **CODE progress (0.76.0):** the fix is LANDED — on iOS the flaky `webkitSpeechRecognition` is skipped
  and the Whisper (MediaRecorder→Groq, audio/mp4) path is primary; a listening WATCHDOG
  (`LISTEN_WATCHDOG_MS`) aborts + falls back if the recognizer fires no events, so "מקשיבה..." can never
  hang forever (bounded fallback per `.claude/rules/voice.md`). Pure decision layer
  `src/services/sttStrategy.ts` (unit-tested 5/5).
  **DEVICE_VERIFIED (0.79.0, Leo iPhone, 2026-07-15) — FIRST real audio:** with the pipeline as default
  (Option C), **voice audio DOES play — Martita heard AbuAI speak.** Hebrew STT + basic memory PARTIALLY
  work. So TTS playback + basic STT are now DEVICE-proven on the pipeline path (no longer just CODE). ✅
  *But the pipeline path is NOT acceptable as the product:* far too SLOW, ROBOTIC, and CANNOT barge-in
  (structural — the chained pipeline is turn-based, not full-duplex), and it had a **date-reasoning bug:
  answered "today" for a "yesterday" question.** These are the standing DEVICE findings. Next priority is
  the **Realtime (Option A) beta path** — the only route to ChatGPT-Live latency/naturalness/barge-in —
  now that baseline audio works; make the Realtime beta audible + device-verified on iPhone (the 0.79.0
  audio-out DOM fix is landed but unproven). Pipeline stays as the reliable fallback.
  **CODE progress (0.104.0, voice-realtime-audible):** the Realtime beta remote-audio path now uses the
  reliable iOS **muted-then-unmute** pattern. The 0.79.0 DOM-append fix alone was insufficient: `ontrack`
  still runs AFTER the `/api/realtime-token` await, i.e. OUTSIDE the tap gesture, so a first `.play()`
  there is autoplay-blocked. Now the REAL remote-audio `<audio>` element is PRIMED inside the tap gesture
  (`enterVoiceMode`): created + `play()`ed muted with a silent primer, appended to the DOM; the session
  reuses that element (`primedAudioEl`), attaches the WebRTC stream in `ontrack`, and UNMUTES it after
  `play()` resolves (unmuting a playing, user-activated element needs no gesture). Grounding: the Realtime
  session instructions now also inject date grounding (Hebrew day/date/time-of-day, Israel TZ) alongside
  the existing family/calendar/memory facts. Bounded/honest failures kept (REALTIME_AUDIO_TIMEOUT watchdog,
  onAudioBlocked tap-to-hear, onFatalError→pipeline). Evidence: `realtimeAudioOut.test.ts` +
  full-duplex + watchdog **23 green (CODE)**; typecheck + full suite green. **NOT device-proven** — WebRTC
  + iOS autoplay cannot run in jsdom; audibility is `PENDING-DEVICE` via
  `diagnostics/operator-protocols/OP-004-realtime-beta-audible.md`. Enable on device with
  `localStorage['abu-voice-realtime-beta']='1'`.
- **STT 🔴** — Hebrew-biased language pin across all 3 engines (CODE). *Blocker:* no device transcript
  accepted. *Next:* device capture → verify Hebrew/Spanish transcription accuracy.
- **TTS 🟡** — Browser playback green; audible warmth on device unproven. *Next:* device audibility test.
- **Online 🔴** — Failed physical acceptance: current World Cup question returned a stale/false
  historical answer. *First divergence:* time-sensitive query answered from model memory instead of a
  retrieval tool. **CODE progress (0.65.0):** the routing half of that first divergence is now closed —
  volatile world-fact questions (current office holders, election results, winners) that the narrow
  category regexes missed used to fall to the offline `general`/LLM path; a semantic `requiresCurrentInfo()`
  detector now routes the whole class to the online provider (or an honest refusal on failure). Regression:
  `src/screens/AbuAI/currentInfoGrounding.test.ts` (17 cases, incl. negative guards vs calendar/evergreen).
  *Still RED because:* the real provider is mocked in every test — no PREVIEW/DEVICE proof that a live
  "who won / latest" query actually returns a grounded, sourced answer on device. *Blocker:* grounding on
  real retrieval on device. *Next:* PREVIEW/device test of "who won / latest" with sources shown
  (see `.claude/rules/online.md`).
  **DEVICE finding + PREVIEW-verified (0.75.0):** a real iPhone test on 0.74.0 returned fabricated World
  Cup fixtures as fact. Root-caused (see `docs/DEVICE_P0_ROOT_CAUSE.md`): probing the deployed
  `/api/abuai-online` showed web_search IS functional (weather → 1 source) but the endpoint returned
  `ok:true` with the model's free text even when web_search returned **0 sources** — surfacing an
  ungrounded/hallucinated answer as fact. **Fix (0.75.0):** zero sources ⇒ honest failure
  (`ONLINE_NO_RESULTS`), the fabricated text is discarded. §47 / NO TOOL RESULT = NO CLAIM. Regression
  `src/eval/onlineGroundingGate.test.ts`. Evidence: **CODE / AUTOMATED_TEST** now; PREVIEW re-verify on
  redeploy. *Residual (queued):* the personal-guard over-blocks "who is the current PM of Israel".
  **PREVIEW progress (0.202.0, real keyed tournament):** all four provider keys are live; ran the REAL
  36-question Hebrew bake-off (`docs/eval/ONLINE_BAKEOFF.json`). Found + fixed a Brave adapter bug
  (`country=IL` → 422). Numbers: incumbent OpenAI 61% citation / 3941ms avg / 8851ms p95 (inadequate for
  voice); **Tavily won** — 100% citation, ~1963ms avg / 3228ms p95, clean speakable Hebrew. Tavily is
  **wired behind `/api/abuai-online` via `selectProvider(ONLINE_PROVIDER)`** (default stays openai; same
  honesty gate; key server-side; personal/family/calendar never online — the calendar query was blocked
  in 1ms on the wired path). Re-ran through the WIRED endpoint against live Tavily: grounded answers in
  0.2–1.6s. This closes the "real grounded retrieval works" sub-blocker at **PREVIEW** class. *Still 🔴
  because:* (a) production activation needs `ONLINE_PROVIDER=tavily` in the Vercel env (a deploy step, not
  done here); (b) on-**device** grounded-answer + spoken latency remains unproven. *Latency caveat:* Tavily
  p95 3.2s can exceed the 2s voice target on some queries — the fix is a bounded client timeout + a truthful
  "checking…" state, with Brave (sub-second) as fallback.
- **Calendar 🔴** — Write→read→modify continuity failed on device. *First divergence:* a just-created
  event not reliably readable/modifiable in the same session. *Next:* device transactional test; a
  gold replay of the failing session (`gold-replay`).
  **CODE progress (0.69.0):** the MANDATORY Spanish scenario (§20.2) "Agendá una reunión con Gabi mañana
  a las tres" was broken end-to-end in the real runtime — the Hebrew STT-recovery dedup rule used a
  Hebrew-only word boundary, so on Spanish it matched a false "a a" duplicate (trailing "a" of "mañana"
  + the preposition "a") and dropped the preposition → "mañana las tres"; the ES clock regex failed, the
  runtime asked "באיזו שעה?" in Hebrew, and "dale" dead-ended (nothing created). Fixed at first divergence:
  the dedup boundary is now script-agnostic (`\p{L}\p{M}`). The scenario now creates exactly once at 15:00
  and "dale" saves. Gold replay `src/eval/spanishCalendarGoldReplay.test.ts` (locale-integrity unit +
  end-to-end §20.2). Evidence: CODE / AUTOMATED_TEST (LLM/online stubbed) — NOT device-proven.
  **CODE progress (0.70.0):** the Spanish create now speaks Spanish end-to-end (§20.2 "remain in Spanish").
  The clarify ("¿A qué hora?"), confirm ("Te agendo una reunión con Gabi mañana a las 15:00. ¿Está bien?"),
  save ("Listo, te agendé…") and cancel are all Spanish; the Hebrew "פגישה עם X" title renders "una reunión
  con X"; the create remembers its language on the draft so it stays Spanish across turns even when a bare
  answer ("a las cuatro") detects as Hebrew (`composeCreate` bypasses Hebrew persona shaping for es). Hebrew
  creates unchanged. Gold replay `src/eval/spanishCreateLocale.test.ts` (confirm/clarify/save language +
  cross-turn continuity + Hebrew-unaffected). Evidence: CODE / AUTOMATED_TEST — NOT device-proven.
  **CODE progress (0.73.0):** the Spanish create now COMPLETES end-to-end. (1) An AM/PM-ambiguous bare hour
  ("anotá una cita el viernes a las diez") is resolved to the default reading for a single-utterance es
  create (es analog of 0.68.0) → confirm → "dale" saves once at 10:00, instead of dead-ending. (2) A Spanish
  "no" (and cancelá/dejá/olvidate/mejor no/nada) now cancels in Spanish ("Dale, lo cancelé…"); a correction
  that merely starts with "no" ("no, a las cuatro") is NOT a cancel. (3) The person-less es title is the
  schedulable noun with correct gender ("una cita"/"un turno"), not the raw request echoed back. Regression
  `src/eval/spanishCreateCompletion.test.ts` (8 cases). Evidence: CODE / AUTOMATED_TEST (typed, deterministic
  runtime, LLM/online stubbed) — NOT device-proven; the VOICE path (Spanish STT/TTS) is device-only →
  Operator Protocol `diagnostics/operator-protocols/OP-002-spanish-voice-create.md`.
  *Remaining es gap (separate):* mid-create meta replies (audio-help / frustration / why-explain) still Hebrew.
- **Working Memory / Follow-up / Correction 🔴** — Follow-up understanding and explicit transcript
  correction failed on device. *Next:* `failure-to-regression` red tests from the real transcripts, then fix.
- **Grounding 🔴** — Residence (Kfar Saba) was presented as live location. *First divergence:* a static
  fact rendered as real-time location. *Next:* device test; assert residence≠live-location copy.
- **Natural Conversation 🔴** — Felt robotic and fragmented on device. **CODE progress (0.66.0):** the
  #1 code-side red-team failure — a fragmented ("drip") calendar create where "תקבעי" → "עם מור" →
  "מחר בשלוש" → "כן" lost the thread and orphaned each fragment to the LLM — is fixed at its first
  divergence: a bare create opener now opens a pending draft that absorbs the following fragments.
  Red-team `fragmented-create-lost` drops **60→24** conversations (1560-conversation run); gold replay
  `src/eval/fragmentedCreateGoldReplay.test.ts`.
  **CODE progress (0.68.0):** the previously-named remaining divergence — an ambiguous bare hour
  ("בשמונה", 7–11) in the fragment path stayed AM/PM-ambiguous so a bare "כן" never completed and
  dead-ended in the loop-breaker — is fixed at its first divergence: the fragment slot-fill
  (`updateCreate`) now resolves a fresh ambiguous hour to the SAME default reading the single-utterance
  smart layer (`understandMeetingSmart`) uses and moves to `confirming`, so "כן" saves exactly once.
  Typed/voice PARITY proven: fragment create === single-utterance create (identical saved event). Same
  flow also fixed: a bare period correction ("לא בערב") at confirm now flips AM→PM instead of being lost
  (tie-break #1, never lose a correction). Gold replay now 6 cases incl. two explicit parity assertions.
  Evidence class: CODE / AUTOMATED_TEST (deterministic runtime, LLM/online stubbed) — NOT device-proven.
  **CODE progress (0.67.0):** the mid-create robotic reprompt is fixed — after the person fragment,
  `shapeCreateClarify` used to emit the bald "באיזה יום?" which the dialogue loop-breaker escalated into a
  dead-end "say it again"; it now asks a warm, person-aware "לאיזה יום ושעה לקבוע עם <who>?" so every
  fragmented create flows naturally (title→day/time→confirm→save). Gold replay asserts T2 naturalness.
  *Still RED because:* device felt-quality is unproven at CODE — *Next:* natural-conversation judge
  (`conversationQualityJudge`) on real transcripts + device re-test.
- **Latency 🔴** — ~20s observed on device. *Next:* per-stage latency budget (`latency-budget`), device timing.
- **Persistent Memory / Family Graph 🟡** — Generated from `knowledge/*`; `validate:family` + gender
  regression green at CODE. Device conversation continuity unproven. *Next:* device continuity test.
  **CODE progress (0.71.0):** ex-spouse directionality (release-gate) fixed — `מי הגרוש של מור`→רפי,
  `ממי מור גרושה`→רפי, and the reverse `רפי הוא הגרוש של מי`→מור now resolve deterministically over the
  symmetric ex-spouse edge (`answerFamilyRelation`), instead of a profile-blurb lookup / LLM guess. Verified
  against `knowledge/family_data.json` (Mor↔Rafi) at runtime, both directions. Never-invent holds (Leo/Ofir
  → no fabricated ex-spouse); current-partner (`מי בת הזוג של מור`→יעל) and Ofir feminine forms ("הנכדה")
  unchanged. Regression `src/screens/AbuAI/exSpouseDirectionality.test.ts` (7/7). Evidence: CODE /
  AUTOMATED_TEST (deterministic function run = HIGH; pure-local path, no LLM) — NOT device-proven.
  **CODE progress (0.72.0):** relation-between-X-and-Martita now resolves when she is named "מרתה" (Marta,
  the everyday spelling of canonical "מרטיטה"). `מה הקשר בין אופיר למרתה` → "מרטיטה הסבתא של אופיר (דרך מור)"
  (was "לא יודעת"). First divergence was name resolution, not the handler: `findNode("מרתה")` was null because
  "מרתה" was not an alias. Added it to Martita's aliases in `knowledge/family_graph.json` (runtime source) +
  `knowledge/family_data.json` (source of truth); `validate:family` + `validate:knowledge` pass. Feminine
  forms (הסבתא / הנכדה) intact; canonical/אבו spellings + ex-spouse directionality unchanged. Regression
  `src/screens/AbuAI/relationBetweenMartita.test.ts` (4/4). Evidence: CODE / AUTOMATED_TEST — NOT device-proven.
  **CODE progress (0.74.0):** possessive spouse queries now grounded. `מי בעלה של אופיר` (Ofir's husband) /
  `מי אשתו של עילי` (Eili's wife) used to punt to the LLM (risking an invented family fact) — the family
  reasoner + classifier matched only "הבעל של"/"האישה של", not the suffix forms "בעלה"/"אשתו". Both now
  recognize the possessive forms → answered from the graph (גלעד / ירדן), never the model. Verified through
  the real controller (`intent=family`, `src≠llm`). Part of the CONVERSATION_GAP_MAP effort
  (`docs/CONVERSATION_GAP_MAP.md`, G1). Regression `src/screens/AbuAI/spouseQueryForms.test.ts` (5/5).
  Evidence: CODE / AUTOMATED_TEST — NOT device-proven. *Related gaps mapped, not yet fixed:* Spanish family
  identity queries still punt (G2); a bare family follow-up ("ומי בעלה") loses the referent (G3).
- **Natural Conversation 🔴** — see `docs/CONVERSATION_GAP_MAP.md`: the controller is the SOLE runtime path
  (`COGNITIVE_RUNTIME_FULL=true`) and its grounded/family coverage is weaker than the deprecated
  `tryGroundedAnswer`, so several grounded-answerable turns punt to the LLM (Spanish family, family
  follow-ups, "who is X" framing, pet recall). 8 gaps severity-ranked with reproducible transcripts +
  first-divergence + smallest fix; device/audio items marked device-gated. G1 fixed (0.74.0).
- **Mobile/PWA 🟡** — Installs + stale-bundle detection (`versionSync`) proven at CODE/BROWSER; device
  audio permission path is the open risk. *Next:* device install + mic-permission walkthrough.
- **Privacy 🟢 (CODE)** — Billable keys server-only, enforced by `clientProviderKeyContract.test.ts`;
  `.env` gitignored + never in history; build-env guard added (`scripts/check-client-secret-leak.cjs`).
  This is CODE-class; it is the right class for this capability (no device claim needed).
- **Diagnostics 🟡** — Rich in-app diagnostics (Product Truth panel, voice flight recorder) at CODE;
  no external SLO/telemetry sink. *Next:* wire a minimal external latency/SLO report.

## How to update this board
Use the `production-reality` skill. Every change to a row must cite the evidence and its class, and
the row's color must be defensible by the WEAKEST honest class. Never upgrade a class you did not observe.
