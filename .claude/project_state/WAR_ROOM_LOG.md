# WAR_ROOM_LOG

## 2026-07-17 — 0.112.0: RC5 — UI CUTOVER (delete/modify + focus → runtime; one path)
- Closed the 0.111.0 wiring gap. index.tsx: RUNTIME_OWNED += calendar_delete/calendar_update; new
  `cogFocusRef` persists the conversation focus across turns (threaded IN to the runtime state, carried
  OUT of every runtime-owned decision, SET after a legacy save); removed the DUPLICATE delete/modify
  handlers + their unused imports. Referable reads + pronoun mutations now reach the app with a human
  Hebrew date. One runtime path per capability.
- Safety: ordering checked — these turns already cleared the free-speech advisory (they used to reach
  the duplicate handlers / LLM), so the earlier runtime block does not newly intercept them. Create/
  confirm intentionally left on the legacy path (bigger, higher-risk cutover for later).
- Test truth: lowered a STALE sanity bound in companionRuntimeGuard (literal count 11→9 because the
  duplicates were removed — the intended outcome; the banned-phrase assertion itself is unchanged, not
  weakened).
- VALIDATION: calendarReferableMutation 7/7 (runtime + cutover source-contract); benchmark **100%**;
  FULL suite **10986 pass / 2 todo / 0 fail** (346 files); typecheck + build clean. Version
  0.111.0→0.112.0 synced. **PREVIEW-pending**: source-contract proves the wiring, not the live render.
- NEXT: fresh PREVIEW to confirm end-to-end (needs deploy trigger); optional create/confirm cutover.

## 2026-07-17 — 0.111.0: RC5 — LEO typed test script + a HONESTY finding (UI wiring gap)
- While building `docs/LEO_TYPED_TEST_SCRIPT.md` (expected answers captured from the REAL runtime), a
  truth-audit of `index.tsx` found that the deployed UI defers only 6 intents to `runCognitiveTurn`
  (`RUNTIME_OWNED`) + keeps DUPLICATE create/delete/modify handlers + never threads `focus`. So
  cycles 26/28 (referable reads, pronoun "cancel it"/"move it") and 29/30 (memory) were CODE-proven
  but NOT reaching the app — only cycle 27 did. Reported honestly rather than papered over (mandate:
  real evidence overrides passing mocks; one runtime path per capability).
- SHIPPED (low-risk): added `memory` to `RUNTIME_OWNED` (new intent, no duplicate handler, checked
  before the legacy path) → saved-memory turns now reach the runtime in the deployed UI. Source-
  contract test on index.tsx. Wrote the typed-test doc with a SOURCE label per item + a "Known wiring
  gap" section for referable calendar turns.
- VALIDATION: savedMemory 10/10; benchmark **100%**; FULL suite **10983 pass / 2 todo / 0 fail** (346
  files); typecheck + build clean. Version 0.110.0→0.111.0 synced across the three files.
- NEXT (medium-risk, needs go-ahead): UI CUTOVER — replace index.tsx duplicate calendar handlers with
  runCognitiveTurn + persist `focus` across turns; then fresh PREVIEW parity over the typed script.

## 2026-07-16 — 0.110.0: RC5 General-Intelligence cycle 6 — saved memories INJECTED into the LLM
- Completes mandate part B. 0.109.0 stored + recalled saved facts deterministically; this makes them
  available to OPEN chat. `formatSavedMemoriesForLLM(loadMemories())` → a labelled system block pushed
  into the general-chat LLM context at BOTH service.ts sites (streaming `chatMessages` + tool-call
  `conversationMessages`), right after the existing ConversationSummary injection. Empty when nothing
  stored; real grounding, honesty rules unchanged.
- VALIDATION: savedMemory 9/9 (formatter unit + BOTH-site source-contract on service.ts); benchmark
  **100%**; FULL suite **10982 pass / 2 todo / 0 fail** (346 files); typecheck + build clean. Version
  0.109.0→0.110.0 synced across version.ts/health.ts/version.test.ts.
- STATUS: memory (part B) complete at CODE level — saved facts (store/recall/forget, privacy-filtered,
  He+Es, LLM-injected) + the pre-existing cross-session summary. NEXT: fresh PREVIEW parity milestone.

## 2026-07-16 — 0.109.0: RC5 General-Intelligence cycle 5 — SAVED MEMORY (text-only)
- MANDATE part B (memory, ChatGPT-style). DISCOVERY first (mandate: reuse, don't rebuild): the
  passive rolling `ConversationSummary` (service.ts) already persists (durable) + injects into the
  LLM; `durableStore` is the IndexedDB-backed persistence layer with reserved keys. GAP: no explicit
  user-COMMANDED memory — "תזכרי ש…" fell to the LLM, which the SYSTEM_PROMPT tells has no cross-
  session store, so nothing was ever truly saved.
- BUILT `savedMemory.ts` (durable-backed, reuses `durable`): saveMemory / loadMemories /
  forgetMemories + command detection (SAVE requires the "ש"/"que" complementizer so a reminder is
  never captured) + a PRIVACY filter at the write boundary (phone/medical/financial/street refused).
  New runtime intent `memory` handles save/recall/forget deterministically BEFORE the LLM.
- RED-first (new capability: pre-wiring these were `general`→needsLLM): `savedMemory.test.ts` asserts
  `intent==='memory'` and durable persistence across FRESH sessions.
- VALIDATION: savedMemory 7/7 (A stores → fresh B recalls → C forgets; privacy refusal; multi-fact;
  Spanish; reminder-not-captured); benchmark **100%**; FULL suite **10980 pass / 2 todo / 0 fail**
  (346 files); typecheck + build clean (also added the `memory` case to metaReasoner's exhaustive
  DOMAIN_OF map). Version 0.108.0→0.109.0 synced across version.ts/health.ts/version.test.ts.
- NEXT: inject saved memories into the general-chat LLM context (source-contract test); then a fresh
  PREVIEW parity milestone across the calendar + memory flows.

## 2026-07-16 — 0.108.0: RC5 General-Intelligence cycle 4 — referable MUTATION (text-only)
- Completes the referable-CRUD flow. Drove a TWO-event store through `runCognitiveTurn`; two real bugs:
  (1) "תבטלי אותה" (cancel IT — pronoun, no noun) → intent=general, needsLLM, DISPLAY=null, event NOT
  deleted (the mandate's exact "cancel it" dead-ended to the LLM). (2) UPDATE readback printed raw ISO.
- RED-first: `calendarReferableMutation.test.ts` — 3/4 red (both cancel-it cases + the friendly-date).
- FIX (general, gated): `isReferentialDelete` = cancel/delete verb + pronoun/bare, anchored; when a
  `calendar_event` is in FOCUS it routes to `calendar_delete` in classifyIntent AND broadens
  `deletePlugin.match` (the plugin re-checks intent, so classification alone was not enough). delete/
  modify resolve the target via the focused event (person) with last-appointment fallback;
  `modifyReasoner` readback now uses `formatHebrewDate`. Explicit-name + last-event paths unchanged.
- VALIDATION: calendarReferableMutation 4/4 (red→green); benchmark **100%**; FULL suite **10972 pass /
  2 todo / 0 fail** (345 files); typecheck + build clean. Version 0.107.0→0.108.0 synced across
  version.ts/health.ts/version.test.ts.
- STATUS: create→where→move→read→cancel (Hebrew) is GREEN end-to-end at CODE level. NEXT: fresh PREVIEW
  spot-check (preview parity milestone); then persistent memory.

## 2026-07-16 — 0.107.0: RC5 General-Intelligence cycle 3 — named-weekday READ (text-only)
- Same referable-CRUD flow, divergence #3 (found in cycle 2's mechanism dump): "מה יש לי ביום חמישי?"
  → "אין כלום ביומן ליום הזה" while the event IS on Thursday. Root: `calendarReadReasoner` handled only
  היום/מחר/מחרתיים/השבוע, else read TODAY — a read that hides a real event is a dead-end.
- RED-first: `calendarNamedWeekdayRead.test.ts` — create+save on Thursday, then "מה יש לי ביום חמישי?"
  expects the event; 1/2 red.
- FIX: resolve a named weekday ("ביום חמישי"/"בשבת") to its NEXT occurrence (today if today is that
  weekday) via `HE_WEEKDAY_IDX`, read that day; honest empty preserved. Scoped to the read reasoner.
- VALIDATION: calendarNamedWeekdayRead 2/2 + calendarReferability 6/6 (red→green); benchmark **100%**;
  FULL suite **10968 pass / 2 todo / 0 fail** (344 files); typecheck + build clean. Version
  0.106.0→0.107.0 synced across version.ts/health.ts/version.test.ts.
- NEXT: friendly update readback + focus-based "move it" targeting (last divergence); then memory.

## 2026-07-16 — 0.106.0: RC5 General-Intelligence cycle 2 — calendar REFERABILITY (text-only)
- MANDATE (RC5 v4, option c): FULL calendar CRUD with the assistant's own actions REFERABLE
  ("where do I meet him", "move it", "cancel the last meeting"). Text-only; voice untouched.
- MECHANISM-FIRST: drove the exact flow through the single runtime (`runCognitiveTurn`) and dumped
  every turn. Create + "כן" saved correctly (focus=רפי, store round-trips). FIRST divergence at
  turn 3 — "**איפה אני פוגשת אותו?**" classified `general` → needsLLM, DISPLAY=null: the pronoun
  property question did NOT resolve against the focused event → false dead-end (the store CAN answer).
  (Also logged, for later cycles: named-weekday read "מה יש לי ביום חמישי?" wrongly says "אין כלום";
  update readback prints raw ISO; "move it" targets via last-appointment heuristic, not focus.)
- RED-first: `calendarReferability.test.ts` — multi-turn through the runtime, real store; 3/6 red
  (WHERE, WHO, chained follow-up dead-ended to the LLM).
- ROOT FIX (general, not a phrase list): `isFocusPropertyQuery` = property-CUE + focus-REFERENCE
  (pronoun אותו/אותה/איתו/זה OR the noun "פגישה") + NO other named person → broadens the bare-form
  `CAL_PROPERTY_RE` gate so referring-pronoun property questions read from the focused event. Leading
  "ו" stripped for chained follow-ups; `answerCalendarProperty` extended to answer "מתי" (date+time).
  Additive: only with a live `calendar_event` focus; a differently-named person still re-searches
  (guard test proves no data leak).
- VALIDATION: calendarReferability 6/6 (red→green); benchmark floor **100%**; FULL suite **10966
  pass / 2 todo / 0 fail** (343 files); typecheck clean; build clean. Version 0.105.0→0.106.0 synced
  across version.ts/health.ts/version.test.ts.
- NEXT: same flow's remaining divergences — named-weekday read; friendly update readback + focus-based
  "move it" targeting; then persistent memory.

## 2026-07-16 — 0.105.0: RC5 General-Intelligence cycle 1 — in-law by COMPOSITION (text-only)
- MANDATE (RC5 v4): know the relation ALGEBRA, not memorized pairs; never dead-end; prove by
  GENERATED novel cases. This is cycle 1, text-layer only (voice/Realtime untouched).
- PROOF FIRST: built `familyRelationGeneralization.test.ts` — generates ALL 240 real person-pairs
  from `family_graph.json` and, via an INDEPENDENT in-test edge oracle, asserts `describeRelation`
  never dead-ends on a graph-derivable pair, is gender-correct, and has He/Es/En parity + symmetry.
  It PASSED → the family engine genuinely generalizes for its supported classes (honest GREEN).
- HONEST RED (found by probing the mandate's named flows): the directional engine `relationOf`
  answered "לא יודעת" for in-laws needing marriage + a MULTI-hop blood relation — Yarden↔Noam
  (wife of a cousin), Gilad↔Leo (husband of a niece), Yarden↔Martita (wife of a grandson). The
  chain is IN the graph, so this was a FALSE dead-end (principle B). RED-first regression:
  `familyInLawComposition.test.ts` (10 fail / 1 pass — the pre-existing one-hop guard).
- ROOT FIX (general, not a pattern list): one composition rule in `relationOf` — an in-law = the
  spouse of any blood relative OR the blood relative of any spouse, at ANY depth — built on a shared
  `bloodRelationKind` algebra, both marriage directions, He+Es, gender-correct. ADDITIVE: fires only
  after the named ladder falls through → cannot regress a named relation. New kind `in_law`
  (self-inverse) added to the inverse-consistency property map.
- VALIDATION: familyInLawComposition 11/11 (red→green); generalization proof 6/6; familyReasoner
  inverse/BFS property 4/4; family+relation+benchmark sweep 87/87 (benchmark floor **100%**);
  FULL suite **10960 pass / 2 todo / 0 fail** (342 files); typecheck clean; build clean (prebuild
  validate:knowledge + validate:family passed). Version bumped 0.104.0→0.105.0 across
  version.ts/health.ts/version.test.ts.
- NEXT: unify the 3 family engines to one path; mirror composition into describeRelation + extend
  the generalization proof to composed pairs; then calendar CRUD referability; then persistent memory.

## 2026-07-15 — 0.79.0: Option C (Leo's decision) — pipeline default, Realtime opt-in beta
- DECISION: after the voice architecture verdict, Leo chose Option C. SINGLE-WRITER re-acquired (HEAD 553a5be).
- PART B (ship win, verified): default voice flipped from the unproven Realtime WebRTC path to the reliable
  pipeline. New pure src/services/voiceModePreference.ts (isRealtimeBetaEnabled: default false → pipeline;
  true only when localStorage abu-voice-realtime-beta=1). index.tsx: `const useRealtime = true` →
  `= isRealtimeBetaEnabled()`. The pipeline TTS (server audio + gesture-unlocked AudioContext + tap-to-hear)
  is the proven-audible path.
- PART A (device-gated fix behind the flag): realtimeVoice.ts remote <audio> element was created but never
  appended to the DOM → iOS/Android autoplay blocked it (the "hears nothing" prime suspect). Now appended
  (hidden) on connect + removed on teardown. Source-contract test realtimeAudioOut. Actual audibility = OP-003.
- TEST TRUTH: 11 source-contract tests asserted `const useRealtime = true` (old default). Updated ALL to the
  Option C contract (`= isRealtimeBetaEnabled()`) — fixing-the-truth per Leo's decision, NOT weakening.
  (Note: a PowerShell Set-Content -Encoding utf8 pass corrupted UTF-8/Hebrew in 10 files → reverted via git
  and redone with Node fs writeFileSync (no BOM). Lesson: never bulk-edit UTF-8 files with PS 5.1 Set-Content.)
- REGRESSION FIRST: voiceModePreference.test (pipeline default) + realtimeAudioOut.test (DOM attach/remove).
- VALIDATION: voiceModePreference 3/3; realtimeAudioOut 3/3; full suite 10822 pass/2 todo/0 fail (312 files);
  tsc clean; build clean. Version 0.78.0→0.79.0. Fresh preview deployed.
- EVIDENCE: Part B = CODE (decision helper verified; pipeline TTS proven at PREVIEW earlier). Part A = CODE
  source-contract; actual iOS audibility DEVICE-GATED (OP-003). NOT overclaimed. Open device question: does
  the default pipeline make audible sound end-to-end on Leo's phone (STT capture is the risk).

## 2026-07-15 — overnight cycle 3 (0.78.0): CONVERSATION_GAP_MAP G2 — Spanish family identity
- SINGLE-WRITER: re-acquired lock (HEAD==origin 8e3d48b, 0/0). v2.1.190 foreground-only.
- REPRODUCED through the controller: "quién es Mor" → intent=general → [LLM] punt (invented-fact risk),
  while Hebrew "מי זאת אופיר" already answered from the graph. describeRelation already renders Spanish
  ("Abu es madre de Mor") — so it was a routing + language-threading gap, not a missing reasoner.
- FIX (smallest): (1) looksLikeFamilyQuery recognizes "quién es <known name>"; (2) familyReasoner got a
  `lang` param + a "quién es X" identity branch → describeRelation('מרטיטה', node, lang); (3) family case
  threads lang → settle es-compose + es unknown-fallback ("No estoy segura de ese parentesco…").
- REGRESSION FIRST → then fix (RED 2→GREEN): src/screens/AbuAI/spanishFamilyIdentity.test.ts (through the
  real controller: source≠llm, Spanish answer no Hebrew; + Hebrew non-regression).
- VALIDATION: spanishFamilyIdentity 3/3; family/gender/spanish non-regression 36; full suite 10816 pass/2
  todo/0 fail (310 files); tsc clean; build clean. Version 0.77.0→0.78.0.
- EVIDENCE: CODE / AUTOMATED_TEST (deterministic, pure-local family path, no LLM). Ofir feminine + ex-spouse
  + possessive-spouse unchanged. Next: G3 (bare family follow-up referent-carry — "y su pareja" / "ומי בעלה").

## 2026-07-14 — overnight cycle 2 (0.77.0): MEMORY P0 — honest about memory
- SINGLE-WRITER: continued under the same lock (HEAD 03676b1). foreground-only.
- ROOT CAUSE: device showed AbuAI implying it has memory ("sometimes I miss things"). Investigation:
  the LLM DOES receive the current conversation (fullTurnBridge:19 sendMessage(messages)) — so the
  dishonest claim is LLM PERSONA, not a wiring-lost-history bug. The prompt had no honesty boundary
  about memory.
- FIX (smallest, honest): SYSTEM_PROMPT (service.ts) — added an explicit rule: no cross-session memory,
  only THIS conversation is visible; never "שכחתי"/"לפעמים אני מפספסת"; anything not said this
  conversation → "לא יודעת / לא סיפרת לי"; what WAS said → remember + continue.
- REGRESSION FIRST → then fix (RED 2→GREEN): src/screens/AbuAI/memoryHonesty.test.ts (source-contract on
  SYSTEM_PROMPT: states no cross-session memory + forbids the dishonest phrasings + requires honest "לא יודעת").
- VALIDATION: memoryHonesty 2/2; full suite 10813 pass/2 todo/0 fail (309 files); tsc clean; build clean.
  Version 0.76.0→0.77.0.
- EVIDENCE: CODE (source-contract). The felt honest behavior is LLM/DEVICE-observable — NOT overclaimed.
  Residual: the CONTINUITY half (does the model reliably get+use the last turn on device) needs a device
  repro to localize (state-reset vs truncation); documented in DEVICE_P0_ROOT_CAUSE.

## 2026-07-14 — overnight cycle 1 (0.76.0): VOICE P0 — iOS Whisper primary + listening watchdog
- MANDATE: autonomous overnight, priority VOICE→MEMORY→CALENDAR→gap map. Single-writer/foreground/rc5-only.
- SINGLE-WRITER: re-acquired lock (HEAD==origin f8ad7a0, 0/0). v2.1.190 foreground-only.
- ROOT CAUSE (from DEVICE_P0_ROOT_CAUSE): iOS webkitSpeechRecognition can start then fire NO events →
  "מקשיבה..." hangs forever; no watchdog on the Web Speech listening path.
- FIX (smallest, well-scoped in the 3,500-line component): new PURE module src/services/sttStrategy.ts
  (isIOS / shouldUseWebSpeechPrimary / LISTEN_WATCHDOG_MS) — unit-tested 5/5. Wired into index.tsx:
  (1) gate the WSR primary block with shouldUseWebSpeechPrimary(nav.*) → iOS skips Web Speech → Whisper
  (MediaRecorder→Groq, audio/mp4) primary; (2) a watchdog armed after rec.start(), cleared by any
  result/end/error, that aborts + startWhisperFallback if no event within LISTEN_WATCHDOG_MS.
- EVIDENCE: sttStrategy 5/5; voice-wiring source-contract tests 52 (index.tsx contracts intact); full
  suite 10811 pass/2 todo/0 fail (308 files); tsc clean; vite build clean. DEVICE-GATED: actual iOS mic
  capture + audible TTS NOT proven in code → OP-003 emitted (diagnostics/operator-protocols/). NOT
  overclaimed — landed CODE, marked PENDING device verification.
- Version 0.75.0→0.76.0. Fresh preview deployed for device re-test.

## 2026-07-14 — DEVICE P0 triage (0.75.0): 4-way root-cause + online grounding gate
- TRIGGER: real iPhone test on the deployed 0.74.0 preview (QA marker confirmed) — FOUNDATIONS broken:
  (1) mic/voice dead, (2) no memory continuity + dishonest "miss things", (3) online hallucinated
  (impossible World Cup fixtures), (4) calendar create ignored fields/didn't save. Device evidence
  OVERRIDES the 10,806 green CODE tests.
- SINGLE-WRITER: re-acquired lock (HEAD==origin 1400b65, 0/0). v2.1.190 foreground-only.
- INVESTIGATION (honest evidence classes): server config healthy (/api/health: OPENAI_API_KEY present,
  routes configured, web_search functional). Client fresh (QA 0.74.0). → 4 INDEPENDENT root causes, not
  one common cause. Full report: docs/DEVICE_P0_ROOT_CAUSE.md.
  - ONLINE: PREVIEW-probed the deployed endpoint — web_search WORKS (weather→1 source) but returns
    ok:true with 0 sources for a no-results query → surfaces ungrounded/hallucinated text as fact.
  - VOICE: DEVICE-GATED. Code audit: primary STT = webkitSpeechRecognition (iOS-unreliable), no watchdog
    on the Web Speech listening path → infinite "מקשיבה". Recorder mime iOS-aware; VITE_GROQ_API_KEY present.
  - MEMORY: LLM fallback DOES get history (fullTurnBridge:19); dishonest line is LLM persona (honest line
    exists at index.tsx:1170). Needs device repro to localize state-reset vs truncation.
  - CALENDAR: controller is sole path + 0.68–0.73 creates green in 10,806 tests → most likely downstream
    of dead STT (spoken create). One typed-create device datapoint decides.
- FIXED (highest-severity PROVABLE): ONLINE grounding gate. api/abuai-online.ts: zero sources ⇒ honest
  failure ONLINE_NO_RESULTS (was ok:true + model free text). §47 / NO TOOL RESULT = NO CLAIM.
- REGRESSION FIRST → then fix (stash-verified RED→GREEN): src/eval/onlineGroundingGate.test.ts (grounded
  ⇒ ok+sources; ungrounded ⇒ honest fail, fabricated text NOT leaked).
- VALIDATION: onlineGroundingGate 2/2; online suite 65; benchmark floor 100%; full suite 10806 pass/2
  todo/0 fail (307 files); tsc clean; build clean. Version 0.74.0→0.75.0.
- EVIDENCE: online fix = CODE/AUTOMATED_TEST (PREVIEW re-verify on redeploy). Voice/memory/calendar remain
  device-gated / need device repro. NOT overclaimed. Next: voice watchdog + iOS→Whisper (+OP-003);
  online Defect B (over-block); memory device repro; calendar typed-create datapoint.

## 2026-07-14 — parity program · recovery cycle 0.74.0 (CONVERSATION_GAP_MAP + G1: possessive spouse)
- SINGLE-WRITER: re-acquired lock (HEAD==origin d54b275, 0/0, prior lock released). v2.1.190 foreground-only.
- FOCUS SHIFT (user-directed): from small calendar/locale fixes to the free conversation itself. Built a
  broad corpus harness over the REAL controller (ExecutiveCognitiveController.handleTurn, LLM/online stubbed
  so punts are visible) across greetings/follow-ups/corrections/reference/topic-shifts/hesitations/ambiguous/
  emotional/memory/mixed-language. Produced docs/CONVERSATION_GAP_MAP.md (8 gaps severity-ranked, each with
  transcript + first divergence + smallest fix; device/audio items device-gated w/ OP references).
- KEY ARCHITECTURAL FINDING: the controller is the SOLE runtime path (index.tsx COGNITIVE_RUNTIME_FULL=true,
  enforced by runtimePathProof.test.ts; the tryGroundedAnswer cascade is DEAD CODE), yet its grounded family
  coverage is WEAKER than that dead tryGroundedAnswer — so grounded-answerable turns punt to the LLM
  (Spanish family "quién es Mor", family follow-ups, "who is X" framing, pet). Proven at CODE via a side-by-side
  table (tryGroundedAnswer answers vs controller punts).
- SELECTED (highest-value machine-provable, smallest-safe): G1 — possessive spouse form. `מי בעלה של אופיר`
  (Ofir's husband) / `מי אשתו של עילי` (Eili's wife) punted; `מי הבעל של אופיר` worked. First divergence:
  familyReasoning REL partner pattern + cognitiveRuntime looksLikeFamilyQuery matched "ה?בעל של"/"ה?אישה של"
  but not the suffix forms "בעלה"/"אשתו". Two coordinated matches needed (reasoner recognizes it AND classifier
  routes to family).
- REGRESSION FIRST → then fix (RED 4→GREEN): src/screens/AbuAI/spouseQueryForms.test.ts (direct
  answerFamilyRelation + THROUGH the controller intent=family src≠llm; non-regression "הבעל של").
- FIX (smallest): added possessive alternatives to the partner REL (familyReasoning.ts) and to
  looksLikeFamilyQuery (cognitiveRuntime.ts). Ground truth verified in family_graph.json (Ofir↔גלעד, Eili↔ירדן).
- VALIDATION: spouseQueryForms 5/5; family/gender non-regression 56 (ex-spouse/relation-between/ofir-gender/
  closure/alias); benchmark floor 100%; full suite 10804 pass/2 todo/0 fail (306 files); tsc clean; build clean.
  Version 0.73.0→0.74.0.
- EVIDENCE: CODE / AUTOMATED_TEST (deterministic, no LLM on this path). NOT device-proven. Next candidates
  (mapped): G2 Spanish family identity queries, G3 bare family follow-up referent-carry, G4 "who is X" framing.
  Device/audio conversation quality remains device-gated (OP for a conversation-quality listening protocol).

## 2026-07-14 — parity program · recovery cycle 0.73.0 (Spanish create completes)
- SINGLE-WRITER: re-acquired lock (HEAD==origin 800d4e8, 0/0, prior lock released). v2.1.190 foreground-only.
- SELECTED DIVERGENCE (user-directed): complete the es create — ambiguous-hour resolution + Spanish no=cancel.
- REPRODUCED at runtime (RED-first): `anotá una cita el viernes a las diez` (parse=10:00 ambiguous) → phase
  stuck "creating", "¿A qué hora?", "dale" → Hebrew loop-breaker, nothing saved. `agendá … a las tres` + `no`
  → "[LLM] no" (punted). Confirmed via probe.
- FIRST DIVERGENCE: (1) understandMeetingSmart is Hebrew-only, so a single-utterance es ambiguous hour is
  never resolved (fresh startCreate path); (2) isCancel/CANCEL is Hebrew-only, so v2 classifySignalV2 (which
  calls isCancel) never sees "no" as explicit_cancel.
- FIX (smallest): (1) in the calendar_create case, after the smart block, when clang==='es' and the ONLY
  missing field is an already-parsed ambiguous time, resolve to the default reading + confirm (scoped to es
  → ZERO Hebrew risk; Hebrew already resolves via smart). (2) Added CANCEL_ES to isCancel (bare "no" /
  cancelá / dejá / olvidate / mejor no / nada, anchored so "no, a las cuatro" stays a correction).
  ALSO fixed a title bug this flow exposed: person-less es title echoed the raw request ("anotá una cita…")
  → now the schedulable noun with correct gender ("una cita" / "un turno") in shapeCreateConfirmES/SavedES.
- REGRESSION FIRST → then fix (stash-verified RED→GREEN): src/eval/spanishCreateCompletion.test.ts (isCancel
  es bare-only + he-unaffected + "no,…"≠cancel; ambiguous-hour save-once at 10:00, clean title no "anotá",
  gender un turno/una cita; ocho/nueve/once; Spanish "no" cancels in Spanish, nothing saved).
- VALIDATION: spanishCreateCompletion 8/8; spanish/fragmented(0.68.0) non-regression; benchmark floor 100%;
  full suite 10799 pass/2 todo/0 fail (305 files); tsc clean; vite build clean. Version 0.72.0→0.73.0 (no
  apostrophes in the label — they break the health BUILD_LABEL regex, caught in 0.72.0).
- OPERATOR PROTOCOL: diagnostics/operator-protocols/OP-002-spanish-voice-create.md (Spanish VOICE create on
  device — STT accuracy + audible Spanish TTS; my fix is typed/CODE only, voice is device-gated).
- EVIDENCE: CODE / AUTOMATED_TEST (deterministic, LLM/online stubbed). NOT device-proven. Residual es:
  mid-create meta replies (audio-help/frustration/why) still Hebrew. Next candidate: relation-between from
  subject's perspective, OR mid-create es meta replies, OR device evidence via OP-001/OP-002.

## 2026-07-14 — parity program · recovery cycle 0.72.0 (relation-between-Martita alias)
- SINGLE-WRITER: re-acquired lock (HEAD==origin 3fe95c3, 0/0, prior lock released). v2.1.190 foreground-only.
- SELECTED DIVERGENCE (user-directed): `מה הקשר בין אופיר למרתה` returned "לא יודעת" — should answer the
  grandmother/granddaughter relation.
- REPRODUCED at runtime (RED-first, via tryGroundedAnswer): `…למרתה`→"לא יודעת"; BUT `…למרטיטה`→"מרטיטה הסבתא
  של אופיר (דרך מור)" and `…לאבו`→same. So the relation-between handler WORKS when the name resolves.
- FIRST DIVERGENCE (mechanism-first, NOT where the user pointed): name resolution — `findNode("מרתה")` was null.
  "מרתה" (Marta) is the everyday spelling of canonical "מרטיטה" but was not an alias (aliases: אבו/Abu/Abuela).
  Fixing the handler would have been wrong; the fix is the alias. Runtime resolves names from `matchNames`
  built by familyKnowledgeLoader ← `knowledge/family_graph.json` (the runtime import, hand-maintained, NOT
  generated by any script; separate from family_data.json).
- FIX (smallest, single-source-respecting): added "מרתה" to Martita's aliases in `knowledge/family_graph.json`
  (runtime source) AND `knowledge/family_data.json` (documented source of truth) to avoid drift. No memory/*
  regen needed — validate:family + validate:knowledge both pass (per-person still 21==21); runtime path uses
  family_graph.json, not memory/*.
- REGRESSION FIRST → then fix: src/screens/AbuAI/relationBetweenMartita.test.ts (findNode resolves; אופיר↔מרתה
  →grandmother feminine "סבתא", never "סבא"; canonical non-regression; מור↔מרתה→mother).
- VALIDATION: relationBetweenMartita 4/4; ofir/exSpouse regressions 23; validate:family + validate:knowledge
  PASS; benchmark floor 100%; FULL suite 10792 pass/2 todo/0 fail (304 files); tsc clean; vite build clean.
  Version 0.71.0→0.72.0 (version.ts + health.ts + version.test.ts; apostrophe in "Martita's" broke the
  health BUILD_LABEL regex → rephrased to "the Martita aliases").
- EVIDENCE: CODE / AUTOMATED_TEST (deterministic function run = HIGH; pure-local, no LLM). NOT device-proven.
  Residual: relation-between still answers from the TARGET's perspective (grandmother) not "granddaughter"
  phrasing — semantically equivalent, kept for consistency with all other relation-between answers. Open es
  items from 0.70.0 remain (ambiguous es hour; Spanish "no"=cancel; mid-create meta replies Hebrew).

## 2026-07-14 — parity program · recovery cycle 0.71.0 (family ex-spouse directionality)
- SELECTED DIVERGENCE (user-directed): option 2 from the 0.69.0/0.70.0 release notes — family ex-spouse
  directionality, a release-gate for family correctness. Martita must get the right answer in BOTH directions.
- GROUND TRUTH (knowledge/family_data.json, verified before writing assertions): Mor (מור, female) ex_spouse=רפי,
  partner=יעל; Raphi (רפי, male) = ex_son_in_law "הגרוש של מור". Ex-spouse is a SYMMETRIC graph edge (exSpousesHe).
- REPRODUCED at runtime (RED-first, via tryGroundedAnswer + answerFamilyRelation): `מי הגרוש של מור` routed to
  family_lookup → returned Mor's profile blurb ("מור, הבת שלך…"), NOT the ex-spouse; `answerFamilyRelation`
  returned null (REL table had grandmother/grandfather/aunt/uncle/children/partner but NO ex-spouse rule) → LLM
  fallback. Reverse `רפי הוא הגרוש של מי` only "passed" by coincidence (Rafi's profile text mentions מור).
- FIRST DIVERGENCE: missing `ex_spouse` rule in `familyReasoning.ts` REL. `tryGroundedAnswer` consults
  `answerFamilyRelation` BEFORE the profile-lookup route, so one rule set fixes forward correctly AND upgrades the
  reverse from coincidental-blurb to deterministic relational answer.
- FIX (smallest): added `exSpouseOf()` (symmetric `exSpousesHe`) + 3 REL regexes each capturing the real person
  name (forward `מי הגרוש/הגרושה של X`, from-whom `ממי X גרושה`/`X גרושה ממי`, reverse `X (הוא/היא) הגרוש של מי`;
  forward excludes the interrogative מי via lookahead). Added `ex_spouse: 'הגרוש/ה'` render label in service.ts
  (gender-neutral like partner's `בן/בת הזוג` — correct in both directions since the edge is symmetric).
- REGRESSION FIRST → then fix: src/screens/AbuAI/exSpouseDirectionality.test.ts (forward/from-whom/reverse/reverse-
  no-copula, resolver known+relation=ex_spouse, never-invent-for-Leo, and partner non-regression מור→יעל).
- ALSO fixed pre-existing drift surfaced by the full suite: copyTurnsButton.test.tsx hardcoded the version at
  0.67.0 (stale since 0.68.0; prior cycles only ran the AbuAI subset). Rewrote it to track the single source
  (shape match) instead of a frozen literal — the canonical contract stays in version.test.ts. NOT a weakening.
- VALIDATION: exSpouseDirectionality 7/7; genderMatrix/rc3/familyReasonerProperties/ofirGenderRegression 56 (Ofir
  feminine forms intact); benchmark floor 100%; FULL suite 10788 pass/2 todo/0 fail (303 files); tsc clean; build
  clean. Version 0.70.0→0.71.0 (version.ts + health.ts + version.test.ts in sync).
- EVIDENCE: CODE / AUTOMATED_TEST (deterministic function run = HIGH; LLM/online not involved — this path is
  pure-local by design). NOT device-proven. Residual es divergences from 0.70.0 still open (ambiguous es hour
  "a las diez"; Spanish "no"=cancel; mid-create meta replies Hebrew). Next candidate: es ambiguous-hour resolution.

## 2026-07-14 — parity program · recovery cycle 0.70.0 (Spanish create stays Spanish, §20.2)
- SINGLE-WRITER: re-acquired lock (HEAD==origin 338b8a0, 0/0, prior lock released). v2.1.190 foreground-only;
  deny rules persisted. Pushed clean at end.
- SELECTED DIVERGENCE (user-directed): after 0.69.0 the mandatory es create SAVES but every AbuAI turn was
  Hebrew — clarify "באיזו שעה?", confirm "…נכון?", save "קבוע —". §20.2 requires "remain in Spanish".
- REPRODUCED at runtime: confirmed all three flows Hebrew. Key insight: detectLang("a las cuatro")='he',
  so per-turn detection flips locale mid-create → the create's language must be REMEMBERED on the draft.
  Also found the draft TITLE is Hebrew ("פגישה עם Gabi") even for es, and composeHebrew/toSpokenText would
  mangle Spanish text.
- FIX: added CreateDraft.lang (persisted across turns); helpers createLangOf/shapeCreatePrompt/composeCreate
  (es bypasses Hebrew persona shaping)/withLang; localized executeSave (es save + conflict warn); rendered
  "פגישה עם X"→"una reunión con X" in shapeCreateConfirmES/shapeCreateSavedES (titleES); added optional lang
  to `settle`. Threaded through the v2 branch (execute_save/cancel/replace/update) AND the intent-path
  calendar_create + confirmation cases (save/cancel/replace/update). ES shapers already existed (reused).
- REGRESSION FIRST → then fix: src/eval/spanishCreateLocale.test.ts (confirm/clarify/save all Spanish, no
  Hebrew chars; cross-turn continuity via "a las cuatro"; Hebrew create unaffected).
- VALIDATION: spanishCreateLocale 5/5; benchmark floor 100%; AbuAI+AbuCalendar+eval 9923 pass/2 todo (zero
  regressions); version 22; tsc clean; vite build clean. Version 0.69.0→0.70.0.
- EVIDENCE: CODE / AUTOMATED_TEST (LLM/online stubbed). NOT device-proven. Residual es divergences documented
  on the Board: (1) bare ambiguous es hour 7–11 ("a las diez") not resolved single-utterance (es analog of
  0.68.0) → "dale" dead-ends; (2) Spanish "no" not recognized as cancel; (3) mid-create meta replies still
  Hebrew. Next cycle candidate: es ambiguous-hour resolution OR family ex-spouse directionality (still open).

## 2026-07-14 — parity program · recovery cycle 0.69.0 (Spanish transcript locale integrity)
- SINGLE-WRITER: re-acquired lock (HEAD==origin 2d32f08, 0/0, prior lock released). v2.1.190 foreground-only;
  deny rules (Agent/Task/worktree) persisted. Pushed clean at end.
- SELECTED DIVERGENCE: probed the 3 §40 hypotheses via the real runtime. Findings — (c) filler-led create
  already WORKS; (a) family ex-spouse directionality is RED (מי הגרוש של מור / ממי מור גרושה / רפי הוא הגרוש
  של מי all punt to LLM while מי בת הזוג של מור→יעל works) — deferred to next cycle; (b) locale contamination
  is RED and the HIGHEST severity: the MANDATORY §20.2 sentence "agendá una reunión con Gabi mañana a las
  tres" fails end-to-end (asks "באיזו שעה?" in Hebrew, "dale" dead-ends, nothing created).
- FIRST DIVERGENCE (isolated it precisely): startCreate() works on the raw sentence (confirming, 15:00), but
  the runtime feeds it recoverTranscript()'s output which corrupts "mañana a las tres" → "mañana las tres".
  Root cause: the dedup LEXICON rule used a HEBREW-ONLY boundary (?<![א-ת]), so on Latin text it captured the
  trailing "a" of "mañana" + the standalone preposition "a" as a false "a a" duplicate.
- FIX (smallest): dedup boundary → script-agnostic \p{L}\p{M}. Whole-word dedup in any script; Spanish safe.
- REGRESSION FIRST → then fix: src/eval/spanishCalendarGoldReplay.test.ts (recoverTranscript locale-integrity
  unit incl. Hebrew+Latin dedup still works, + §20.2 end-to-end create-once-at-15:00 + "dale" saves).
- VALIDATION: gold replay 5/5; AbuAI+AbuCalendar+eval 9918 pass/2 todo (zero regressions); version 22; tsc
  clean; vite build clean. Version 0.68.0→0.69.0 (version.ts+health.ts+version.test.ts).
- EVIDENCE CLASS: CODE / AUTOMATED_TEST (LLM/online stubbed). NOT device-proven. Remaining locale gap
  (separate divergence, documented): Spanish create clarify/confirm text still Hebrew. Next cycle candidate:
  family ex-spouse directionality (a) OR Spanish confirm/clarify localization.

## 2026-07-13 — ChatGPT-Live parity program · recovery cycle 0.68.0 (fragment ambiguous-hour parity)
- SINGLE-WRITER: acquired `.abuai/ACTIVE_EXECUTION_LOCK.json` (gitignored); Claude Code 2.1.190
  (subagents run in background by default → NO subagent dispatch used, foreground-only). Added deny
  rules (Agent/Task/git worktree) to `.claude/settings.local.json`. Branch rc5 sole-writer verified
  (2 setup commits ahead of origin, 0 behind).
- RECONCILE: verified NEXT_ACTION (2026-06-30) claim "Spanish create isCreateIntent=false" is STALE —
  Spanish create is now implemented (CREATE_INTENT_ES). Benchmark saturated at 100% floor.
- SELECTED DIVERGENCE (board-named, machine-provable, no device): fragment "drip" create with an
  AM/PM-ambiguous bare hour stayed ambiguous so a bare "כן" never completed (dead-ended in loop-breaker),
  while the single-utterance path resolved via the smart layer → a typed/voice PARITY defect.
- FIRST DIVERGENCE: `understandMeetingSmart` resolves the ambiguous hour only for a single utterance
  (needs who+date+time together); the fragment slot-fill (`updateCreate`) kept `ambiguousTime` and
  reported time missing forever.
- FIX (smallest): `updateCreate` fresh-ambiguous-hour branch resolves to the same default reading + moves
  to confirming; confirm branch absorbs a bare period correction ("לא בערב") to flip AM→PM.
- REGRESSION FIRST → then fix: `src/eval/fragmentedCreateGoldReplay.test.ts` 4→6 cases (2 parity + 1
  correction assertion; corrected the old test that encoded the bug).
- VALIDATION: gold replay 6/6; AbuAI 4302 pass/2 todo; AbuCalendar+eval 5611 pass; version 22 pass;
  tsc clean; vite build clean. Version 0.67.0→0.68.0 (src/version.ts + api/health.ts + version.test.ts).
- EVIDENCE CLASS: CODE / AUTOMATED_TEST (LLM/online stubbed). NOT device-proven. Board Natural
  Conversation row stays 🔴 pending device felt-quality.

## 2026-06-30 — Production War Room OS established
- Created .claude Production OS (CLAUDE.md, project_state, agents, skills, hooks).
- Triage with evidence (see CURRENT_STATE / PRODUCTION_STATUS).
- Findings: build/test green; deploy healthy; no exposed secrets; realtime provider
  down (fallback validated); physical voice device-gated. NO open code P0.

## 2026-06-30 — Mission Commander loop (find → implement → measure → repeat)
### Iteration 1 — localized + offline-aware chat-failure copy (commit 1d36335, v0.8.2)
- FOUND (production-commander, evidence): terminal "all providers failed" path
  yielded ONE hardcoded Hebrew line (service.ts:1473/1571) regardless of language
  or offline state — a dead-end for a Spanish/offline user; localized copy infra
  already existed (serverChatProvider).
- IMPLEMENTED: chatTerminalFallback(messages,{offline}) — detectLanguage + navigator.onLine
  → he/es/en + "no internet" vs "provider down". Hebrew default kept (back-compat).
- MEASURED: chatFailureCopy.test.ts (8 HIGH-evidence assertions) green; static-grep
  tests (236) unchanged; suite 5971→5979.

### Iteration 2 — lazy-load reminderStore off AbuAI first-open (commit 94c64c1, v0.8.3)
- FOUND (commander runner-up): reminderStore (delivery+durable) statically imported
  into AbuAI, only used in 2 reminder-confirm branches.
- IMPLEMENTED: await import() in those 2 async branches; removed static import.
- MEASURED (build chunk table): reminderStore 164 kB / 61 kB-gzip eager → 13 kB /
  5.4 kB-gzip on-demand. tsc clean, build exit 0, suite 5979 green.

## Next iteration candidates (not yet done)
- Localize the NON-error user-facing strings only where the user must ACT (most
  Hebrew UI is by design — do NOT mass-localize).
- Real runtime assertions to replace remaining static-grep "tests" (evidence upgrade).
- Re-run production-commander for the next biggest improvement with fresh evidence.

## Intelligence Parity Program (text-only, no mic) — Cycle 1: DATE/TIME (v0.80.0)
- MISSION: fix ALL of AbuAI intelligence in TEXT via the real ExecutiveCognitiveController
  (machine-provable, no device). Voice/Realtime DEFERRED to the end, untouched.
- METHOD: drove the real controller over a broad He+Es+mixed corpus
  (src/eval/intelligenceGapProbe.test.ts) -> docs/INTELLIGENCE_GAP_MAP.md.
- FIRST DIVERGENCE: dateReasoner always answered with now; DATE_QUERY_RE only matched
  today/date phrasings. "airze tarich haya etmol" -> TODAY (confidently WRONG);
  relative-day -> LLM (no clock); "matai hachag haba" -> LLM hallucination.
- FIX: relative-offset (etmol/shilshom/machar/machratayim + es ayer/manana) + next-holiday
  reasoner (fixed table) resolved deterministically from ctx.now; new RELATIVE_DATE_QUERY_RE
  + HOLIDAY_QUERY_RE route to date_query; calendar read path untouched.
- EVIDENCE: relativeDateReasoning.test.ts 8/8 green (CODE); full suite 10831 passed / 0
  failed; typecheck + build clean. Calendar create->confirm->save->readback->correction
  re-verified working in text (prior save-fail was a node-env localStorage artifact).
- NEXT: Cycle 2 - "lama hashamayim kchulim" misrouted to frustration (why-challenge hijack).

## Intelligence Parity Program — Cycle 2: CONVERSATION QUALITY / Q2 (v0.81.0)
- FIRST DIVERGENCE: WHY_RE began with ^lamah(no-hebrew) matching ANY "lamah <x>" — an
  innocent knowledge question ("lamah hashamayim kchulim" = why is the sky blue) was
  routed to a frustration CHALLENGE (apology) instead of being answered.
- FIX (conversationOS.ts): narrowed WHY_RE to bare "lamah?" + specific challenge phrasings
  (lamah lo kavat / lamah ein lecha / lamah etzlech); "why <topic>" now reaches general/LLM.
- EVIDENCE: whyKnowledgeVsChallenge.test.ts 5/5 green (real controller + predicate);
  targeted challenge suites 318 green; full suite 10836 passed / 0 failed; typecheck + build clean.
- NEXT: Cycle 3 - FAMILY (Spanish "quien es Ofir" fails, "her mother" continuity, graph counts).

## Intelligence Parity Program — Cycle 3: FAMILY parity (v0.82.0)
- (1) Singular "mi habat/haben shel X" (daughter/son of X) punted to the LLM (engine knew
  only PLURAL children). FIX: gender-filtered daughter/son rules (childrenByGenderPublic);
  "mi habat shel Martita" -> Mor, "mi haben shel Martita" -> Leo, deterministic.
- (2) Spanish "quien es X" returned the unknown fallback because the resolver regex was
  ^-anchored and the leading inverted-? broke it (Hebrew "mi ze X" worked). FIX: tolerate
  the inverted-?/? punctuation + render Spanish ("Abu es abuela de Ofir a traves de Mor").
- EVIDENCE: familyDaughterSonSpanish.test.ts 4/4 green; family regression suites 62 green;
  full suite 10840 passed / 0 failed; typecheck + build clean.
- DEFERRED (each its own mechanism): F6 grandchild-count queries; M2 pronoun continuity.
- NEXT: Cycle 4 - M2 continuity ("u-mi ima shela") or F6 counts.

## Intelligence Parity Program — Cycle 4: FAMILY parent + pronoun continuity / M2 (v0.83.0)
- (1) Singular "mi ima/aba shel X" (mother/father of X) punted to the LLM (no parent rule).
  FIX: gender-filtered mother/father rules (parentsByGenderPublic); "mi ima shel Ofir" -> Mor.
- (2) Follow-up pronoun had no antecedent: after "mi ze Ofir", "u-mi ima shela" returned the
  unknown fallback. FIX: working-memory antecedent (lastFamilySubject) + resolveFamilyPronoun
  rewrites shela/shelo/shelahem to the last-discussed person -> "mi ima shel Ofir" -> Mor.
- EVIDENCE: familyPronounContinuity.test.ts 2/2 green; family + continuity suites 66 green;
  full suite 10842 passed / 0 failed; typecheck + build clean.
- NEXT: Cycle 5 - F6 grandchild-count; then ONLINE provider-boundary stale-answer repro.

## Intelligence Parity Program — Cycle 5: FAMILY count queries / F6 (v0.84.0)
- "kama nechadim/yeladim/ninim yesh le-<X>" (how many grandchildren/children/great-grandchildren)
  punted to the LLM (no count reasoner; single family name so routing never reached the graph).
- FIX: familyCountReasoner (grandchildrenOfPublic / greatGrandchildrenOfPublic / childrenOfPublic)
  + routing. "kama nechadim yesh le-Martita" -> "yesh le-Martita 6 nechadim: Ofir, Aylon, Eili,
  Adar, Adi ve-Noam"; "kama nechadim yesh li" (self) -> "lach". Deterministic count + grounded list.
- EVIDENCE: familyCountQueries.test.ts 4/4 green; family suites 246 green; full suite 10846
  passed / 0 failed; typecheck + build clean. Family cycle complete in text (F1-F6, M2 closed).
- NEXT: Cycle 6 - ONLINE provider-boundary stale-answer reproduction (PREVIEW class, live provider).

## Intelligence Parity Program — Cycle 6: ONLINE cache-collapse (v0.85.0)
- ROOT CAUSE of "repeated identical answers to different questions": the provider
  stale-while-revalidate cache (answerOnlineCurrentInfo) keyed by the COARSE queryKind
  (general_current / news / sports), so two different same-kind questions within the 30-min
  TTL returned the SAME cached answer.
- FIX: key the cache by kind + the specific normalized query. Identical repeats still hit
  the cache; different questions never share an answer.
- Separately PROVED the controller online ROUTING is already clean (onlineStaleAnswerProbe:
  2 consecutive different online turns each call the tool with their own query + get own answer).
- EVIDENCE: onlineCacheCollapse.test.ts 2/2 + onlineProvider.test.ts + probe green; full
  suite 10849 passed / 0 failed; typecheck + build clean.
- REMAINING (PREVIEW-class, NOT CODE): end-to-end live grounding needs a real provider call.

## Intelligence Parity Program — Cycle 7: meal time-of-day / C4 (v0.86.0)
- "kabei aruchat erev im Anabel be-yom shishi be-shmone" scheduled an 8 AM dinner: the bare
  hour "be-shmone" was ambiguous and defaulted to morning because "aruchat erev" (dinner) was
  not a period hint (PERIOD_PM matched only "be-erev", not the bare meal noun).
- FIX: meal-context hints (aruchat erev/tzohorayim/dinner -> PM, aruchat boker -> AM). Dinner
  -> 20:00. A truly bare hour with no meal/period context stays ambiguous (unchanged). Also
  fixes a latent bug: "aruchat boker be-shesh" no longer flips to 18:00.
- EVIDENCE: mealTimeOfDay.test.ts 4/4 green; calendar suites 150 green; full suite 10853
  passed / 0 failed; typecheck + build clean.
- REMAINING (low sev): meal-noun TITLE ("aruchat erev im Anabel" vs "pgisha im Anabel").

## Intelligence Parity Program — Cycle 8: clinic location capture / C5 (v0.87.0)
- "tikbei pgisha im harofe machar baboker be-kupat cholim be-Kfar Saba be-tesha" captured the
  location as only "Kfar Saba" — "kupat cholim" (HMO clinic, the real venue) was dropped
  because it was not a venue head-word, so the extractor fell to the bare-city match.
- FIX: added kupat-cholim (+ abbreviations) to VENUE_HEAD -> location "kupat cholim be-Kfar
  Saba"; the time (be-tesha) never leaks in.
- EVIDENCE: clinicLocationCapture.test.ts 2/2 green (extractor + real controller); extractor +
  calendar suites 125 green; full suite 10855 passed / 0 failed; typecheck + build clean.
- Calendar drafting gaps C1-C5 closed. Remaining (low sev): meal-noun TITLE. Big remaining
  item is LIVE online grounding (PREVIEW-class, needs a real provider call).

## Intelligence Parity Program — Cycle 9: relative date/time arithmetic (v0.88.0)
- Expanded probe corpus (intelligenceGapProbe2) surfaced new gaps: dateReasoner did fixed
  offset WORDS but not ARITHMETIC. "beod shlosha yamim" (in 3 days) -> TODAY (confidently
  wrong); "beod shavua" -> LLM; "ma hashaa beod shaatayim" -> 10:00 (not 12:00).
- FIX: beodDaysOffset (beod N yamim/yomayim/shavua/shvuayim/N shavuot -> forward date) +
  beodHoursOffset (beod N shaot/shaa/shaatayim -> clock + N hours), deterministic from
  ctx.now; RELATIVE_DATE_QUERY_RE extended to route "beod" questions to date_query.
- EVIDENCE: relativeDateArithmetic.test.ts 6/6 green; date suites 31 green; full suite 10862
  passed / 0 failed; typecheck + build clean.
- NEXT (probe 2 backlog): siblings ("mi ach shel Mor"), mid-create PERSON change, Spanish
  family-relation/create. LIVE online grounding remains PREVIEW-class.

## Intelligence Parity Program — Cycle 10: family siblings (v0.89.0)
- Probe-2 gap FAM-SIB: "mi ach/achot shel X" (brother/sister of X) returned the unknown
  fallback (no sibling rule), though Leo is Mor brother in the graph.
- FIX: siblingsByGenderPublic (the OTHER children of the parents, gender-filtered) +
  brother/sister/plural REL rules: "mi ach shel Mor" -> Leo; "mi achot shel Leo" -> Mor.
  No fabrication when there is no sibling of that gender (stays honest).
- EVIDENCE: familySiblings.test.ts 3/3 green; family suites 56 green; full suite 10865
  passed / 0 failed; typecheck + build clean.
- NEXT (probe-2 backlog): mid-create PERSON change, Spanish family-relation/create, next-weekday.

## Intelligence Parity Program — Cycle 11: mid-create person correction (v0.90.0)
- After "tikbei pgisha im Dani...", "lo, lo im Dani, im Mor" fell to the LLM — the pending-
  create engines had no PERSON-correction path (only date/time), so a companion swap with no
  date/time hit the off-topic guard and parked as a side question (a later "ken" would save
  the STALE person). Traced the live path to conversationV2 (classifySignalV2/reduceV2),
  NOT resolvePendingMessage.
- FIX: PERSON_CORRECTION_RE in V2 (negation + new im/etzel <name>) -> field_answer -> update;
  shared updateCreate now swaps the companion + rewrites the title while confirming.
  "lo, lo im Dani, im Mor" -> "pgisha im Mor"; "ken" saves Mor (not Dani).
- EVIDENCE: createPersonCorrection.test.ts 2/2 green; calendar + V2 suites 329 green; full
  suite 10867 passed / 0 failed; typecheck + build clean.
- NEXT (probe-2 backlog): Spanish family-relation + Spanish create; next-weekday.

## Intelligence Parity — Cycle 12: calendar midnight / device failure (v0.91.0)
- Built deviceFailuresTriage.test.ts reproducing Leo device failures. Confirmed + FIXED:
  "pgisha im Ofir machar be-chatzot be-cafe Ilana" asked "be-eizo shaa" though "be-chatzot"
  (midnight) was said; the no-verb form fell to the LLM. parseHebrewTimeDetailed did not
  resolve be-chatzot + it was not a narrative TIME_CUE.
- FIX: be-chatzot/chatzot/chatzot ha-layla -> 00:00, chatzot ha-yom -> 12:00, and be-chatzot
  added to TIME_CUE. Now -> calendar_create person=Ofir place=cafe Ilana time=00:00, no re-ask.
- EVIDENCE: calendarMidnight.test.ts 4/4 green; calendar suites 130 green; full suite 10872
  passed / 0 failed; typecheck + build clean.
- RANKED device-failure backlog: 13 Spanish relation-between, 14 online follow-up continuity,
  15 Independence/memorial deterministic dates, 16 memory honesty + last-question recall.

## Intelligence Parity — Cycle 13: Spanish relation-between (v0.92.0)
- "que relacion hay entre Anabel y Leo" fell to the LLM though the Hebrew "ma hakesher bein
  Anabel le-Leo" resolves deterministically. The directional kinship engine was Hebrew-only.
- FIX: bilingual relationOf — LABEL_ES (every RelationKind), lang param rendering es with the
  canonical Latin name ("Mor es madre de Ofir"), Spanish parsing (relacion entre X y Y /
  que es X para Y), + routing. Latent bug also fixed: relationOf now resolves Latin/alias
  names via findNode (its local matchNames index lacked them).
- EVIDENCE: spanishRelationBetween.test.ts 3/3 green; family suites 66 green; full suite
  10875 passed / 0 failed; typecheck + build clean.
- NEXT (device backlog): 14 online follow-up continuity, 15 Independence/memorial dates,
  16 memory honesty + last-question recall.

## Intelligence Parity — Cycle 14: top-scorer online (v0.93.0)
- Device failures: "who is the top scorer" not answered; "u-mi melech ha-shearim" after a
  sports answer fell to the LLM. The sports online detector required explicit context
  (mundial/kaduregel) and did not recognize "melech ha-shearim" (top scorer) / "mi hivkia"
  (who scored) on their own -> answered from model memory instead of retrieval.
- FIX: added melech/malkat ha-shearim, mi hivkia, ha-koveesh ha-movil to ONLINE_HE_SPORTS.
  Standalone AND follow-up top-scorer now route online.
- EVIDENCE: topScorerOnline.test.ts 3/3 green; online suites 116 green; full suite 10878
  passed / 0 failed; typecheck + build clean. LIVE provider correctness is PREVIEW-class.
- NEXT (device backlog): 15 Independence/memorial deterministic dates, 16 memory honesty +
  last-question recall.

## Intelligence Parity — Cycle 15: civic-holiday online (v0.94.0)
- Device failure: wrong Independence Day (gave 2024 / past date). National/civic days
  (yom haatzmaut/chag haatzmaut, yom hazikaron, yom hashoah, yom yerushalayim, es "dia de la
  independencia") are NOT in the deterministic religious-holiday table and their Gregorian
  date is nidche-adjusted (postponement) -> hardcoding/computing would risk INVENTING a wrong date.
- Two RED cases: "be-eize tarich yom haatzmaut" matched date_query -> returned TODAY (confidently
  wrong); "matai chag haatzmaut" / the Spanish form -> LLM.
- FIX: CIVIC_HOLIDAY_RE routed to LIVE retrieval BEFORE date_query and before the LLM fallback.
  Religious holidays (rosh hashana/pesach) + relative dates (etmol) are NOT hijacked.
- EVIDENCE: civicHolidayOnline.test.ts 7/7 green; date+online suites 70 green; full suite
  10885 passed / 0 failed; typecheck + build clean.
- DECISION: exact date left to the LIVE provider (PREVIEW-class); nidche computation intentionally
  NOT hardcoded (avoid inventing dates). NEXT: Cycle 16 memory honesty + last-question recall.

## Intelligence Parity — Cycle 16: memory honesty + last-question recall (v0.95.0)
- Two device failures. (1) "implied it had memory while having none": a CROSS-SESSION memory
  question ("at zocheret ma amarti lach etmol" / "te acordas ... ayer") now gets a deterministic
  HONEST reply that never implies past-session memory. CROSS_SESSION_MEMORY_RE requires a
  past-session time marker so within-session "ma amarti kodem" is untouched.
- (2) "what was my last question": "ma shaalti otcha kodem" / "que te pregunte" now recalls the
  prior user question from THIS session (raw message history -> last recorded question ->
  honest nothing-yet), never the LLM.
- Both handled in the continuation case; RECALL_TOPIC + resume unaffected.
- EVIDENCE: memoryHonestyRecall.test.ts 4/4 green; continuation suites 515 green; full suite
  10889 passed / 0 failed; typecheck + build clean.
- The device-failures triage backlog is now cleared in text. Remaining: LIVE online grounding
  (PREVIEW-class). NEXT: widen the probe corpus for new gaps.

## Intelligence Parity — Cycle 17: next-weekday (v0.96.0)
- Widened the probe corpus (Spanish create, next-weekday, age, math/units, translations,
  emotional). Confidently-wrong gap: "eize tarich yom shlishi haba" matched date_query ->
  returned TODAY; "matai yom rishon haba" -> LLM.
- FIX: nextWeekdayAnswer (next occurrence of a weekday, strictly after today) +
  NEXT_WEEKDAY_QUERY_RE (date-asking frame so a create is not hijacked). Fixed a latent ASCII
  word-boundary bug in the frame regex (the matai forms had silently gone to the LLM).
- EVIDENCE: nextWeekday.test.ts 5/5 green; date+calendar suites 117 green; full suite 10894
  passed / 0 failed; typecheck + build clean.
- Widened-probe backlog (mostly LLM-legitimate): Spanish create "cena" (dinner) -> LLM;
  math/units; age. General knowledge/translations/emotional = LLM job (no fix).
- NEXT: Spanish create "cena", or a deterministic calculator for math/units.

## Intelligence Parity — Cycle 18: Spanish meal-create (v0.97.0)
- "agenda una cena con Anabel el viernes a las ocho" fell to the LLM while "anota una cita"
  works — CREATE_INTENT_ES recognized cita/reunion/turno/evento but not meal nouns; and a
  bare "a las ocho" for a cena defaulted to 08:00 (an 8 AM dinner, the Spanish twin of C4).
- FIX: added cena/almuerzo/comida/desayuno/cafe/merienda to the Spanish schedulable objects
  + cena/almuerzo/merienda -> PM (desayuno -> AM) meal-context period. Now -> calendar_create
  with Anabel, viernes, 20:00.
- EVIDENCE: spanishDinnerCreate.test.ts 3/3 green; Spanish + calendar suites 111 green; full
  suite 10897 passed / 0 failed; typecheck + build clean.
- NEXT (backlog): deterministic math/units calculator; age queries; else re-probe. Cannot
  close in text: LIVE online grounding.

## Intelligence Parity — Cycle 19: math calculator + wide-probe triage (v0.98.0)
- Ran a FAR wider adversarial probe (math/money/units, calendar CRUD, family, dates, current-
  info, definitions, translations, letter/bill, emotional, chitchat, ambiguous, mixed).
- FIXED (highest value, deterministic): everyday arithmetic fell to the LLM. Added mathReasoner
  (multiply/divide/add/subtract via He+Es operator words + true x-div symbols; percent-of;
  percent-tip with total; He+Es output) + new math intent routed before online. isMathQuery
  matches only real expressions (price "kama ole chalav" still online); ASCII +-*/ excluded so
  times/dates/ratios are never mis-read.
- EVIDENCE: mathReasoner.test.ts 8/8 green; math+calendar+online suites 333 green; full suite
  10905 passed / 0 failed; typecheck + build clean.
- TRIAGED BACKLOG (gap map): timezone "ma hashaa be-New York" (WRONG-gives Israel), backward
  date "lifnei shavua", days-until-end-of-month, unit conversions, family grandchildren/in-law,
  Spanish reminder "recordame", recurring reminder, "beetzem lo" misroute, zmanim/parsha->online.
- LLM-LEGIT (leave): translations, definitions, letter/bill help, emotional, chitchat.
- CANNOT CLOSE IN TEXT: currency FX rate, end-to-end LIVE online grounding.

## Intelligence Parity — Cycle 20: time-in-city / timezone (v0.99.0)
- Wide-probe confidently-wrong bug: "ma hashaa be-New York" returned the LOCAL Israel clock
  (10:00) instead of New York time — the TIME branch ignored the city.
- FIX: CITY_TZ map (NY, Buenos Aires/Argentina, London, Paris, Madrid, Barcelona, LA, Miami,
  Moscow, Berlin, Rome, Tokyo, Sydney, Dubai; He+Es names) + timeInCity via
  Intl.DateTimeFormat(timeZone) — deterministic regardless of runner TZ. Unknown cities fall
  through to local honestly; bare "ma hashaa" unchanged.
- EVIDENCE: timeInCity.test.ts 5/5 green; date+time suites 50 green; full suite 10910 passed /
  0 failed; typecheck + build clean.
- NEXT (backlog): backward date "lifnei shavua"; days-until-end-of-month; unit conversions;
  family grandchildren/in-law + verify "ben hazug shel Mor->Yael"; Spanish "recordame";
  recurring reminder; "beetzem lo" misroute.

## Intelligence Parity — Cycle 21: backward date arithmetic (v0.100.0)
- "eize yom haya lifnei shavua" fell to the LLM; dateReasoner did FORWARD ("beod") but not
  BACKWARD arithmetic.
- FIX: lifneiDaysOffset (lifnei N yamim/yomayim/shavua/shvuayim/N shavuot -> backward day
  offset) + extended RELATIVE_DATE_QUERY_RE to route "lifnei" to date_query. "lifnei shavua"
  -> yom revii 8 be-yuli; "lifnei yomayim" -> yom sheni 13 be-yuli. Forward unchanged.
- EVIDENCE: backwardDate.test.ts 5/5 green; date suites 122 green; full suite 10915 passed /
  0 failed; typecheck + build clean. (0.100 = 0.x foundation sequence, not a 1.0 GA.)
- NEXT (backlog): days-until-end-of-month; unit conversions; family grandchildren/in-law +
  verify "ben hazug shel Mor->Yael"; Spanish "recordame".

## Intelligence Parity — Cycle 22: unit conversions (v0.101.0)
- Everyday unit conversions ("3 km be-metrim", "chatzi kilo be-gram", "30 celsius be-fahrenheit")
  fell to the LLM.
- FIX: extended mathReasoner with convertUnits — length (km/m/cm), mass (kg/g), volume (l/ml)
  via fixed factors + same-dimension check, temp C<->F via the real formula, He word quantities
  (chatzi=0.5, reva=0.25, shloshet-revei=0.75). Fixed a substring collision: "kilo" inside
  "kilometr" matched the kg unit (kg now uses kilo(?!metr)) so "3 km be-metrim" -> 3000, not a
  km->kg dimension error. Price/mismatched-units -> null -> still online.
- EVIDENCE: unitConversion.test.ts 7/7 + mathReasoner.test.ts 8/8 green; calendar+online suites
  309 green; full suite 10922 passed / 0 failed; typecheck + build clean.
- NEXT (backlog): days-until-end-of-month; family grandchildren/in-law + verify ben-hazug-Mor;
  Spanish "recordame"; recurring reminder; "beetzem lo" misroute.

## Intelligence Parity — Cycle 23: grandchildren-of-X + family-data verify (v0.102.0)
- VERIFIED against knowledge/family_data.json: "ben hazug shel Mor -> Yael" is CORRECT (Yael
  is Mor partner) — NOT a wrong-person bug. Honest verification before assuming a bug.
- Real gap fixed: "mi hanechadim shel X" fell to the LLM (routing matched singular nechad/
  nechada, not plural nechadim/nechadot; no grandchildren-of-X rule).
- FIX: grandchildren REL rule (grandchildrenOfPublic) + plural routing. "mi hanechadim shel Mor"
  -> Anabel, Ari; "mi hanechadim shel Leo" -> honest (none), never fabricated.
- EVIDENCE: grandchildrenOfX.test.ts 3/3 green; family suites 256 green; full suite 10925
  passed / 0 failed; typecheck + build clean.
- NEXT (backlog): days-until-end-of-month; Spanish "recordame"; recurring reminder; "beetzem lo"
  misroute; (low) gis/sibling-in-law.
