# AbuBank — Deep Review Dossier (code-blind audit pack)

**Purpose.** This document lets an external expert audit the *entire* application at full depth **without reading the source** — function signatures, control flow, data schemas, enums, error codes, invariants, and known defects are stated explicitly with `file:line` anchors so claims can be spot-checked. Heaviest depth on **AbuAI** and **AbuCalendar**. Nothing is excluded; uncertain items are marked.

- App identity: `package.json` name `abu-bank`, **version `30.10.0`**. ⚠️ **Inconsistency:** `src/version.ts` and `api/health.ts` report `0.5.0-production-candidate`, buildDate `2026-06-11`, stale `branchHint: feat/calendar-revolution`. Two version identities coexist (see §13 F-V1).
- Branch: `rc5/cognitive-architecture-and-acceptance`; HEAD `65f0183`.
- Verified this review cycle: `tsc --noEmit` clean · `vitest run` **4570 pass / 0 fail / 165 files** · `vite build` + PWA green · online grounding/freshness **live-proven on deployed Vercel Edge**.
- Target user: Martita, 80+, Hebrew + Rioplatense Spanish, Kfar Saba. Senior-first UX is a hard requirement.

> **How to read this:** Each subsystem gives Responsibility → Key contracts (signatures) → Control flow → Invariants → Limitations/TODOs. §13 consolidates every known defect with severity. §14 is the prioritized findings list. §15 is the reviewer's question checklist. Evidence tiers: **HIGH** = executed assertion / live 200 with payload; **MED** = deterministic harness with stub LLM / static-source check; **LOW** = specified only, never run with real model/user.

---

## 1. System overview & architecture

Single-page PWA. React 18 + TypeScript + Vite 5 + `vite-plugin-pwa` + Zustand. Capacitor 8 wrappers present (iOS/Android bridge). A `Shell` renders one screen at a time from a `Screen` enum; Home/AbuAI/AbuWhatsApp/Settings are full-screen (hide Header/BottomBar). Heavy screens (AbuAI, AbuCalendar, AbuWeather, AbuGames, FamilyGallery) are lazy-loaded under `Suspense`, each wrapped in an `ErrorBoundary`.

**Trust architecture (the product's spine):** a *deterministic* layer answers whenever it can (family graph, calendar tools, parsers) and the *LLM* is used only for prose/paraphrase or open chat. Multiple guards prevent the LLM from inventing personal facts (truth guard, honesty contract, companion composer, server+client personal-block). This is why ~80% of behavior is testable without a model.

**Three AI surfaces:**
- **AbuAI** — conversational companion (chat + voice).
- **AbuCalendar** — voice/text appointment + reminder management.
- **AbuWhatsApp** — Martita-style message generation (Groq/Gemini/OpenAI client-side).

**Provider posture:** OpenAI is server-proxied (key never in client bundle). Groq + Gemini are client-side free-tier fallbacks (`VITE_*` keys in the bundle — see §12 security note). Azure/Edge/Google TTS via dev proxies.

---

## 2. Tech stack, build, PWA, deployment

- **Scripts** (`package.json`): `dev`=vite; `build`=`tsc && vite build`; `prebuild`=`generate:memory && validate:family`; `test`=`vitest run`; `typecheck`=`tsc --noEmit`; `check`=both; `generate:memory`/`validate:family` via tsx; `workbench`. Git hooks via `prepare`.
- **Key deps:** react 18.3, zustand 4.5, idb 8.0 (IndexedDB), vite-plugin-pwa 0.21, @capacitor/* 8.4, @phosphor-icons/react, edge-tts, ws.
- **vite.config.ts** (dev-only server plugins — **NOT in production**): OpenAI chat proxy (`/api/abuai-chat`, reads `VITE_OPENAI_API_KEY`, SSE + JSON), TTS proxies (`/api/aztts` Azure, `/api/tts` Edge-TTS WS, `/api/gtts` Google), QA log receiver (`/__abu_calendar_qa_log` → `tmp/`). Dev server `host:true` (LAN/iPhone), optional HTTPS from `tmp/dev-cert/`, `Cache-Control: no-store`. Build target `es2020`, esbuild minify, no manual chunks (single bundle).
- **PWA:** manifest `AbuBank`, scope `/`, `standalone`, dir `rtl`, lang `he`, theme `#050A18`, icons 192 (any) + 512 (maskable). Workbox `runtimeCaching:[]` (all static precache), `skipWaiting`, `clientsClaim`. Build precaches ~25 entries (~880 KiB).
- **vercel.json:** `buildCommand npm run build`, `outputDirectory dist`, framework vite. Serverless functions in `api/*` run on **Edge runtime**.
- **Deployment note (verified):** `npx vercel dev` locally returns **HTTP 500 on Edge functions that make an outbound fetch** under Node 24 (`abuai-chat`, `abuai-online`, `abuai-stt`); `health` (no outbound fetch) works. The **deployed** Edge endpoints return 200 with correct payloads. → This is a **local emulation artifact, not a code defect**; test against the deploy URL.

---

## 3. State management & navigation (Shell)

**Store:** `src/state/store.ts` — Zustand `useAppStore`.
State: `currentScreen` (Screen.Home), `isNavigating`, `activeServiceId`, `navCancelled`, `isMoreModalOpen`, `adminUnlocked`, `adminFirstBoot`, `adminInitComplete` (false until init resolves — "H1-FIX"), `storageMode` ('persistent'|'volatile'), `services` (spread of `IMMUTABLE_DEFAULTS`), `installDismissed`, `isOnline` (`navigator.onLine`), `appVersion`, `lastError`.
Actions: `setScreen`, `setNavigating`, `setNavCancelled`, `setActiveServiceId`, `setMoreModalOpen`, `unlock/lockAdmin`, `setAdminFirstBoot`, `setAdminInitComplete`, `setStorageMode`, `setServices`, `setInstallDismissed`, `setOnline`, `setError(screen,msg)`, `clearError`.

**Screen enum** (`src/state/types.ts`): `Home, Opening, Offline, Error, Admin, AbuAI, AbuWhatsApp, Settings, AbuGames, AbuWeather, AbuCalendar, FamilyGallery`.

**Services** (`src/state/defaults.ts`): `IMMUTABLE_DEFAULTS` = `Object.freeze([...])` of 9 banking/utility tiles (Mizrahi, Postal Bank, max, Arnona KS, IEC, Water KS, yes, Partner, HOT mobile) — each `{id,label,url(HTTPS),iconPath}`.

**App lifecycle** (`src/App.tsx`): init order — read services (fallback to defaults + `volatile`), read admin first-boot, then `setAdminInitComplete(true)`, restore install-dismissal. Listeners: `visibilitychange`→`cancelNavigation()` then `lockAdmin()` (separate calls, "M2-FIX"); `pagehide`/`freeze`→`cancelNavigation()`; `online`/`offline`→`setOnline`; `unhandledrejection`→`setError`+navigate to `Error`. **`blur` deliberately not registered.**

**Navigation service** (`src/services/navigationService.ts`): module-level timers (not in store). `openService(id)`: online-check first → 250ms per-tile debounce → URL validation (HTTPS, reject `replace-me.invalid`) → lock + Screen.Opening → 3000ms watchdog → 800ms delay → `window.open(url,'_blank','noopener,noreferrer')`. `cancelNavigation()` clears timers/state. `retryNavigation()` re-opens `activeServiceId`.

---

## 4. Persistence layer

### 4.1 `durableStore.ts` — the durable KV (write-through IndexedDB + localStorage mirror)
- **Backend:** IndexedDB DB `abu-durable`, store `kv`, v1 (via `idb`). Test/SSR fallback: in-memory `MemoryBackend` with `snapshot()`.
- **API:** `durable.init()` (idempotent migrate+restore), `isReady()`, `getString`, `setString` (write-through: cache + localStorage + async backend, errors swallowed), `remove`, `getJSON<T>(key,fallback)` (corruption-tolerant), `setJSON<T>`, `exportAll()`/`importAll(blob)` (schema-versioned backup).
- **CRITICAL_KEYS (managed/migrated):** `abubank-calendar-appointments` (safety-critical), `abu_reminders_v1` (safety-critical), `abuai-conversation-history`, `abuai-conversation-summary`, `abutime-memory`, `martita-contacts-v1`, `martita-loc-contacts-v1`.
- **init() flow:** read backend (degrade to `{}` on error) → for each managed key absent in backend but present in localStorage, migrate (fire-and-forget) → hydrate cache → repopulate localStorage mirror (eviction recovery) → stamp `__abu_schema_version__='1'`.
- **Invariants:** sync reads never block (cache→localStorage); writes fire-and-forget (UI never waits); migration idempotent; JSON corruption falls back to mirror then default; **no throws to UI**.
- **Evidence (HIGH):** `e2e/persistence.spec.ts` Playwright — seed localStorage → reload (migrate→IndexedDB) → assert in IndexedDB → clear localStorage (eviction) → reload (restore mirror). Last run `status: passed, 0 failed`. Unit: `durableStore.test.ts` in the 4570 suite.

### 4.2 `storageService.ts` — services + admin meta (separate DB)
- DB `abu-bank-db` v1, stores `services` (keyPath id), `meta` (keyPath key). `readServices`/`writeServices` validate all 9 (id,label,url HTTPS,iconPath); **any invalid record discards the whole array**; empty→`EMPTY_DB`; 3000ms open timeout ("M5-FIX"). `readMeta`/`writeMeta`. Error codes: `EMPTY_DB|VALIDATION_FAILED|DB_FAILURE|WRITE_FAILED|META_WRITE_FAILED`.

---

## 5. Data model — family graph (source of truth)

**Source of truth:** `knowledge/family_data.json` — **all runtime reads from here** (CLAUDE.md). 21 entities across: `matriarch` (Martita), `deceased` (Papi/Pepe, b.1941, `date_of_passing 2025-01-01`, `memorial_date 01-01`), `children` [Mor, Leo], `children_related` [Raphi, Yael], `grandchildren_mor` [Ofir, Ayalon, Eili, Adar], `grandchildren_leo` [Adi, Noam], `grandchildren_spouses` [Yarden(=Eili's wife), Gilad(=Ofir's spouse)], `great_grandchildren` [Anabel, Ari (children of Ofir+Gilad)], `pets` [Tutsi, Tonto], `close_friends` [Mirta, Shoshana, Sharon].

**Member schema:** `canonical_name, hebrew_name, aliases[], relationship, relationship_hebrew, spouse?, partner?, ex_spouse?, children[], birthday?(MM-DD), location?, notes?`.

**Generated memory** (`scripts/generate-memory-from-knowledge.ts`, `npm run generate:memory`): `memory/family_graph.yaml`, `aliases_and_names.yaml`, `martita_profile.yaml` — all marked "100% GENERATED — DO NOT EDIT". `memory/birthdays_registry.yaml` is **hand-maintained** (not generated) → source of D-2 (§13).

**Validation** (`scripts/validate-family-data.ts`, in `prebuild` + pre-commit hook): structural checks + relationship assertions (Mor÷Raphi, Mor partner Yael, Ofir married Gilad, Eili married Yarden, **"Yarden married to Eili (not Ofir)"**, Anabel child of Ofir+Gilad) + forbidden-pattern checks on the **generated** YAMLs. ⚠️ It does **not** scan `birthdays_registry.yaml`, so D-2's wrong label there passes validation.

**Runtime graph** (`familyGraph.ts`): `GraphNode {canonical, hebrew, aliases[], matchNames[], childrenHe[], parentsHe[], spousesHe[], partnersHe[], exSpousesHe[], role, gender}`. Bidirectional edges, lazily built + cached. `findNode(name)` matches `matchNames` then first token. ⚠️ Parent backfill is **structurally hardcoded** for Rafi/Ofir/Gilad (familyGraph.ts:140-151) — adding family members requires code change, not just JSON.

`describeRelation(a,b,lang)→string|null`: 8-level precedence (spouse/partner/ex → parent↔child → siblings → sibling-of-spouse → parent-of-spouse → aunt/uncle → first cousins → ancestor↔descendant BFS). Returns human kinship phrase or **null (never invents)**.

`familyLoader.generateFamilyPromptSection()` formats the Hebrew family block injected into the AbuAI system prompt.

---

## 6. AbuAI — conversational companion (PRIMARY FOCUS)

### 6.1 Files & responsibilities
`index.tsx` (turn lifecycle, voice orchestration, SYSTEM_PROMPT) · `service.ts` (LLM calls, grounding, STT, summary, provider chain) · `router.ts` (intent classification) · `companionPlanner.ts` (STEP 1–7 decision) · `companionComposer.ts` (response floor) · `contextResolver.ts` + `relationalResolver.ts` (follow-ups) · `groundedResponse.ts`/`grounding.ts`/`tools.ts` (deterministic answers) · `onlineIntent.ts`/`onlineProvider.ts`/`sourceRouter.ts`/`realtimeCheapSourceRouter.ts` (online) · `truthGuard.ts`/honesty tests (anti-hallucination) · `serverChatProvider.ts` (proxy client) · `aiSpendGuard.ts` (cost cap) · `proactive.ts`/`dailyContentPack.ts`/`contentWorldEngine.ts` (companionship). 82 test files.

### 6.2 Turn lifecycle — `handleSend(text?)` (index.tsx:357), exact ordered control flow
The orchestrator runs ~23 stages with many **early returns** (high-priority intents short-circuit before the LLM):
1. Trace start + `resolvePronouns()` (e.g. "אליו"→last person "נועם").
2. `resolveFollowUp()` (e.g. "ומחר?"→"מה יש לי מחר?").
3. Queue user msg; `deriveStateFromMessages()` (scan last 10 for lastPerson + sticky mood); `planCompanionTurn()`→CompanionPlan.
4. Backtracking rewrite ("תחזרי ל-X"→"ספרי לי על X").
5. **Calendar-create state machine** (if `createState.phase!=='idle'`): cancel/save/replace/read/clarify; save path verifies via `loadAppointments()` then deterministic readback; early return.
6. Free-speech advisory (cross-domain no-side-effect answers); early return.
7. **Reminder pending flow** (awaiting time or confirmation); early return.
8. Unresolved-pronoun guard on create intent ("למי את מתכוונת?").
9. Reminder intent detection (incl. "שבוע לפני יום הולדת של X" birthday fusion); early return.
10. Calendar search / delete / modify.
11. Calendar create (recurring, 4 occurrences).
12. Calendar create (regular) → `startCreate()`; early return.
13. Abort/nevermind ("עזבי") → warm ack; early return.
14. **Emotional suppression check:** if last assistant turn was emotional + not a direct question + `plan.suppressLookups` → **skip grounding** (force LLM). Else `tryGroundedAnswer()`; if non-null and route is family/calendar → `groundedLLMAnswer()` (LLM paraphrases *verified* facts) → `enforceCompanion()` → push; early return.
15. Conversation recall ("מה אמרתי / על מי דיברנו").
16. **Proactive layer:** `getProactiveSeed()` (boredom/loneliness/missing-pepe); rotates, never repeats last seed.
17. Content-world engine ("open_chat" with gentle options).
18. **Online current-info:** if `isOnlineCurrentInfoQuery() && !shouldBlockOnlineForPersonal()` → placeholder "רגע, בודקת אונליין…" → `answerOnlineCurrentInfo()` → append sources + `enforceCompanion()`.
19. Temporal current-data guard (forex/scores/temperature without online intent) → honest "can't check now".
20. Personal query (non-streaming) → placeholder → `sendMessage()`.
21. **General LLM streaming:** `streamMessage()` token loop → truth-guard `containsUngroundedClaim()` → `enforceCompanion()`.
22. Error handling → `mediateError()`→ErrorCard.
23. Finally: clear loading/streaming, refocus.

### 6.3 Routing — `router.ts`
`RouteType` (13): `family_lookup, family_location, family_relationship_between, calendar_today, calendar_tomorrow, calendar_upcoming, calendar_exact_date, calendar_month, calendar_create, birthday_lookup, memorial_lookup, contact_action, non_personal`.
`routePersonalQuery(text)` priority (selected): **create before read**; today/tomorrow/upcoming/weekday; ES/EN calendar; birthday/memorial lookup; month birthdays; past/exact dates; **relationship-between before single-subject**; family location; family lookup; ES/EN family Q (falls through if name unknown — e.g. "Italy"); **OPEN_TOPIC guard** forces `non_personal` even if a token looks like a name; **contact-action before loose family**; known-name fallback; default `non_personal`. Pure, no side effects.

### 6.4 Decision engine — `companionPlanner.ts` (STEP 1–7, pure)
`Frame = companionship|emotion|task|fact` (priority in that order). `Mood = grief|lonely|bored|worried|proud|happy|frustrated|neutral`. `Act = listen|stay_quiet|answer|confirm|ask|lead|continue|suggest|encourage|deepen|redirect`. `CalRelevance = create|read|remind|none`.
`CompanionPlan { step1_goal, step2_emotion, step3_familyEntity, step4_continuity{resolvedPerson,continuesTopic}, step5_calendar, step6_onlineNeeded, step7_frame, step7_act, suppressLookups, reason }`.
**Suppression rule:** negative emotion (grief/worried/frustrated/lonely) → `frame=emotion, suppressLookups=true` (no family/calendar lookups even if a name/date appears); bored → `frame=companionship, suppress=true, act=lead`; positive → encourage; continuity → `act=continue`; else calendar/online/family/general. **Sticky emotion** survives an incidental factual turn (e.g. "מה השעה?" mid-grief stays in emotion frame) — verified by `continuity20.harness` turn 13.
`deriveStateFromMessages(msgs)` returns `ConversationState {lastPerson, lastTopic, lastMood, emotionalContext, openLoops}`.

### 6.5 Response floor — `companionComposer.ts`
`findBannedPhrase(text)→string|null` and `enforceCompanion(text,plan)→string`. Banned register categories: database/search ("על פי הנתונים","חיפשתי באינטרנט"), customer-support ("אשמח לעזור","יש עוד משהו"), patronizing ("שאלה מצוינת","כל הכבוד"), AI self-reference, English equivalents ("as an ai","how can i help","according to the data"). On empty/banned result → per-act fallback line (never empty). **This is the last line of defense before text reaches Martita.**

### 6.6 Grounding & follow-ups
`tryGroundedAnswer(text)→string|null` (service.ts): switch on route → execute tool (`getTodayEvents/getTomorrowEvents/getWeekEvents/getEventsByDate/searchFamily/getBirthdayFor/getMemorialFor/describeRelation`) → before/after filter via `parseQueryBoundaryTime` → shape via `responseShaper` → return or null (fall through to LLM).
`parseQueryBoundaryTime(text)` (service.ts:31): handles numeric *and* bare Hebrew hour-words after לפני/אחרי ("אחרי ארבע"→16:00 via `applyReadPeriod`: 1–6→PM default). **Verified working** (`boundaryTimeQuery.test.ts`).
`resolveFollowUp(text,msgs)→{resolved,wasFollowUp}` (contextResolver): temporal fragments ("ומחר?"), multi-word ("ומה אחרי זה?"→week, "ומה ביום הבא?"→tomorrow), name fragments ("ומור?"→"ספרי לי על מור"), "ועוד?", general continuation ("תמשיכי"→"ספרי לי עוד על {topic}" when not family/cal), "באותו יום" date extraction. ⚠️ Continuation rewrite is suppressed when an older personal context out-ranks the immediate topic — the real continuity for non-personal topics flows through `plan.act='continue'`+LLM history (verified `continuity20.harness` turn 10).
`resolveRelationalQuery(text,'es'|'en')→string|null` (relationalResolver): parses "la X de Y" / "Y's X"; maps relation; walks graph; **honest negative** ("Mor no tiene hija") or null; never invents.

### 6.7 LLM integration & provider chain — `service.ts`
**SYSTEM_PROMPT** (≈ lines 745–844) defines Martita's profile, tool access, forbidden register, permitted register, 2–10 sentence output, no markdown. **Honesty contract** ordered so the live-info "never invent" clause precedes the safety clause (survives truncation). Few-shot examples for utility/emotion/opinion/Spanish/online-refusal/correction.
Providers (`getProviders(voiceMode)`): **voice** = OpenAI(`gpt-4o-mini`)→Groq(`llama-3.3-70b-versatile`)→Gemini(`gemini-2.0-flash`); **text** = OpenAI(`gpt-4o`)→Gemini→Groq. Cooldowns: OpenAI 5 min (quota/missing), Groq/Gemini 60s; if all cooling, force-add. OpenAI via server proxy only (no client key). `sendMessage()` non-streaming, `streamMessage()` SSE generator.
`groundedLLMAnswer(userMsg,facts,recent,fallback)`: 8s timeout; prompt forbids invention; returns fallback on failure.
**Conversation summary:** `updateSummaryFromMessages()` (pattern, every 10 msgs) + `generateLLMSummary()` (LLM, every 20 msgs). `ConversationSummary {updatedAt, peopleDiscussed[], topicsDiscussed[], appointmentsMentioned[], emotionalContext, lastUserRequest, factsMentioned[]}`. ✅ **Fixed last cycle:** `generateLLMSummary` now uses the correct proxy contract (`sendServerChat`) — previously silently always fell back (`summaryProxyContract.test.ts`).

### 6.8 Online subsystem
`onlineIntent.isOnlineCurrentInfoQuery()` + `getOnlineQueryKind()→ movies|weather|news|open_now|latest|sports|general_current|holidays|null` (multilingual regex). `shouldBlockOnlineForPersonal()` blocks family/calendar from going online (client side).
`onlineProvider.answerOnlineCurrentInfo(query,opts)→OnlineResult`: client personal-guard; **30-min in-memory cache** (lost on reload); 2–600 char validation; 14s timeout; POST `/api/abuai-online`; error map `OPENAI_API_KEY_MISSING|ONLINE_PROVIDER_FAILED|ONLINE_QUERY_BLOCKED_PERSONAL|ONLINE_TIMEOUT|BAD_REQUEST|CLIENT_NETWORK_ERROR`; success unwraps `{answer,sources[]}`.
`sourceRouter.chooseAbuAISource()→ calendar_tool|family_tool|contacts_tool|weather_api|online_search|open_conversation|proactive_content|practical_help` with `requiresEvidence/requiresSources/locationAware`. Personal tools first; online only when not personal.
`realtimeCheapSourceRouter` cost-bands sources; ⚠️ **TODO**: weather routed to `weather_api`(free) but Open-Meteo fetcher **not wired** — falls back to paid `online_search`.
**Server** (`api/abuai-online.ts`, Edge): server-side personal guard (belt-and-suspenders); `OPENAI_API_KEY ?? VITE_OPENAI_API_KEY`; OpenAI **Responses API** `gpt-4o-mini` + `tools:[{type:'web_search'}]`; 12s timeout; extracts `output_text` + `url_citation` sources. **Verified live: 200, grounded, current-dated, with real sources.**

### 6.9 Truth / honesty guards (anti-hallucination)
`containsUngroundedClaim(text, hadToolCall)`: when `hadToolCall===false`, blocks "יש לך תור / I see you have / לפי היומן / Tienes cita / invented date-time" patterns; **allowed when a tool actually ran**. Allowed-always honest phrases ("לא מצליחה לבדוק","No lo encontré","I don't have live access"). `noHallucination` forbids past-tense success verbs (בדקתי/חיפשתי/אימתתי/מצאתי/"searched online") unless negated (לא מצאתי). Honesty contract test asserts the live-info clause precedes safety in the prompt. **Evidence MED** (deterministic tests; real-model adherence is LOW until pilot).

### 6.10 Spend guard — `aiSpendGuard.ts` (pure)
`SPEND_LIMITS {maxOnlineSearchesPerDay:30, maxVoiceMinutesPerDay:20, maxEstimatedSpendPerDayUSD:3}`. `checkSpendAllowed({operation,usage,estimatedCostUsd?,lang?})→` reason `allowed|online_searches_limit|voice_minutes_limit|daily_spend_limit|invalid_usage_input`. Global $3 cap checked first. User copy never mentions money. ⚠️ **TODO (defect F-SP1):** counters are **not persisted** — caller passes them and nothing wires storage, so a page reload resets the daily cap (cap is effectively bypassable).

### 6.11 Voice subsystem (AbuAI)
**Realtime** (`services/realtimeVoice.ts`): `RealtimeVoiceSession`, model `gpt-4o-realtime-preview`, voice `shimmer`, `OpenAI-Beta: realtime=v1` (required). `connect()`: `isPlaceholderKey()`→immediate quiet fallback (no retry); ephemeral token from `/v1/realtime/sessions`; WebRTC PC + data channel; 10s connect timeout; server-VAD (threshold 0.75, silence 900ms) in quiet mode, push-to-talk in noisy mode, passive in listen mode; **max 2 retries** (1s/2s backoff). States `idle|connecting|listening|speaking|error`.
**TTS** (`services/voice.ts`): `speak()` chain OpenAI(`gpt-4o-mini-tts`,coral,paid; 300s cooldown after 429/402)→Gemini(`gemini-2.5-flash-preview-tts`,Kore,free; PCM→WAV)→Web Speech (Carmit/Google, rate 0.88 HE/0.90 ES). `speakVoiceMode()`: OpenAI→Gemini, **no robot fallback** (text-only if both fail). iOS audio unlock via shared AudioContext. Streaming TTS via `AudioChunkQueue` (sentence-boundary chunking, 12-token flush for Hebrew). Trace to `abu-tts-trace` (last 20).
**Recording** (`services/recording.ts`): MIME priority mp4(iPhone)→webm/opus→ogg; `getUserMedia({echoCancellation,noiseSuppression,autoGainControl})`.
**STT** (`service.ts:990–1130`): Groq `whisper-large-v3` (skip iPhone mp4; 2-min cooldown after 400; disable-for-session on 400) → OpenAI Whisper via `/api/abuai-stt` (iPhone-safe, 15s timeout). `STT_MAX_CONSECUTIVE=3` → `SttExhaustedError("…תנסי לכתוב במקום")`. `resetSttFailureCount()/getSttConsecutiveFailures()`.
**Voice safety verified without device** (`voiceKeySafety.test.ts`): placeholder/invalid/short key → quiet fallback, bounded retries. **Real mic/realtime/TTS playback remain LEO-device-only (LOW).**

### 6.12 Companionship content
`proactive.ts`: `ProactiveIntent = boredom|no_topic|loneliness|ideas|sadness|talk_to_me|missing_pepe|thanks|happiness|greeting`; `getProactiveSeed()` with deterministic rotation + language fallback chain [lang,es,he,en]; **all seeds linted by `hasForbiddenTone()`** (no patronizing/therapy/customer-service). `dailyContentPack.buildDailyContentPack()`: dedupe + round-robin cap to 5 seeds; **missing data omitted, never invented; never overrides live tools**. `contentWorldEngine.chooseContentWorld()→` 12 ContentModes with `needsRealtime/needsSources` flags; never invents events.

---

## 7. AbuCalendar — appointments & reminders (PRIMARY FOCUS)

### 7.1 Storage keys & schemas
Keys: `abubank-calendar-appointments`, `abubank-alert-minutes`, `abubank-alerted-ids`, `abutime-memory`, `abu_reminders_v1`.
`Appointment {id, title, date(YYYY-MM-DD), time(HH:MM), emoji, color(rotating 8-hex pool), notes?, location?, type?('regular'|'birthday'|'anniversary'|'memory'), personName?, birthYear?, isRecurring?}`.
`Reminder {id, kind:'reminder', category(medication|call|home|appointment_prep|water|general), title, dueAt(YYYY-MM-DDTHH:MM:SS local, no Z), displayDateLabel, displayTimeLabel, recurrence?{frequency:daily|weekly|custom, daysOfWeek?, time}, alertPolicy{sound,voice,repeatUntilConfirmed,snoozeMinutes,remindBeforeMinutes?,maxRepeats?}, status(scheduled|due|snoozed|done|overdue|cancelled), snoozedUntil?, confirmedAt?, createdAt, updatedAt}`.

### 7.2 Appointment CRUD & safe creation
`loadAppointments/saveAppointments(durable+mirror)/addAppointment(id+next color)/updateAppointment/deleteAppointment/loadAppointmentsWithFamily(year)` (merges generated family birthdays/memorials, IDs `"{id}-{year}"`).
**`createAppointmentSafe()` (P0 single entry for manual + voice):** validate title/date/time + format + ranges → `addAppointment()` → **round-trip read-back via `loadAppointments()`** → returns `{ok:true,appointment}` or `{ok:false,code: missing_title|missing_date|missing_time|invalid_date|invalid_time|storage_failed}`. Round-trip defeats silent storage no-ops (private mode/quota). Confirmation/failure copy localized (HE default, ES/EN heuristics).
`detectEmoji(title+notes)` → 🧵🏥✂️💊🛒🎂🍽️✈️👨‍👩‍👧📌.

### 7.3 Voice → create pipeline
`index.tsx` recording lifecycle: mic diagnostics → `getUserMedia` (constraint fallback) → `MediaRecorder` (mime fallback) → **max 22s**, **silence auto-stop 2.5s after ≥1.5s speech**, **min 1s** guard → `mr.onstop`: blob validation (≥1 chunk, ≥1000 bytes), **20s transcribe watchdog** → `transcribeCalendarAudio()` → `normalizeCalendarTranscript()` (deterministic domain correction) → branch:
- `isScheduleQuery()` → open AbuTime.
- `detectReminderIntent()` → `parseReminder()` → reminder flow.
- else `processVoiceTranscript()` (`voiceAutoCreate.ts`) → one of: `not_calendar|low_confidence|auto_created|show_confirm_card|needs_am_pm|needs_clarification|failed_to_save|failed_to_understand`.
**Auto-create only if:** complete (title+date+unambiguous time) AND a create-verb present AND **no family-relationship descriptor** AND semantic validation passes → `createAppointmentSafe()`. Otherwise a card is shown. **No silent save ever** (ConfirmCard P0).

### 7.4 Parsers
`calendarTranscribe.ts`: Groq `whisper-large-v3` primary, `whisper-large-v3-turbo` fallback (only 429/5xx), domain prompt (family names + Israeli places + calendar vocab), `verbose_json` (avgLogprob/noSpeechProb/compressionRatio), temp 0, 18s timeout; 401→no fallback.
`localParser.parseLocally(text,todayISO)→LocalDraft{title,date,time,ambiguousTime,location,notes,emoji,confidence,personPhrase}`: stutter/self-correction cleanup; date (היום/מחר/מחרתיים, weekday→next, "30 במאי" w/ rollover, numeric, ES/EN); time (midnight cases, "רבע ל-X", numeric, Hebrew words + fractions, period application — **1–6 with no period hint ⇒ ambiguous=true, never auto-assumed**); location (street/floor/51 cities); notes (causal/relative clauses); title (strip 20 command patterns); confidence 0–1.
`semanticIntent.extractCalendarIntentLocally()→CalendarIntentDraft`: CREATE/STRONG_SCHED/CONVERSATION_ONLY regex; resolves date/time/location/title/people; classification `not_calendar|create_calendar_event|unclear`; confidence high≥0.86/med≥0.6/low; reduced to 0.35 on low-ASR (avgLogprob<-1.2 / noSpeechProb>0.7 / compressionRatio>3.0); `validation: valid_for_auto_create|valid_needs_confirmation|missing_fields|low_confidence|not_calendar`.
`correctionParser.parseCorrection()→{kind: cancel|update|confirm|clarify|unrelated, updates, ambiguousTime}`: negation/vague-rejection/confirm patterns; "זה לא A, זה B"→parse B; **period inheritance** across corrections.
`intentParser`: `isScheduleQuery/isFamilyQuery/extractQueryTimeframe/validateParsedIntent/buildClarificationQuestion/buildConfirmationText`.

### 7.5 Reminders
`reminderParser.parseReminder(text,todayISO)→ReminderDraft`: `detectReminderIntent()` 10-rule precedence (appointment vs reminder vs medication vs recurring); `parseRelativeTime()` (שעתיים/חצי שעה/רבע שעה/numeric/word-numbers/compound "שעה ו-20 דקות"); `parseRecurrence()` (כל יום/בוקר/ערב→daily, כל שבוע ביום X→weekly); `detectCategory()`; person extraction → `familyResolve`; readback "להזכיר לך {title} {dateLabel} בשעה {timeLabel}".
`reminderStore.ts` (`abu_reminders_v1`): CRUD + `createReminder` (schedules native notif) / `snoozeReminder` / `markReminderDone` / `cancelReminder`; `listDue/listToday(local date, not UTC)/listScheduled/listRecurring`; default policy `{sound,voice,repeatUntilConfirmed:false,snoozeMinutes:10,remindBeforeMinutes:0,maxRepeats:3}`; write round-trips via localStorage length check.
`reminderDelivery.ts` (Capacitor LocalNotifications): re-fire **medication 15/30/45 min**, **default 30/60/90 min**; native ID = hash(reminderId)*10 (+1/+2/+3 follow-ups); permission request (web no-op).

### 7.6 Family resolution (calendar)
`familyResolve.resolvePersonPhrase()→ {resolved|ambiguous|missing|none}`: bare name via findNode; kinship descriptor walk (spouse/parent/ex/sibling/grandparent/grandchild/child/friend-as-partner) with gender filtering; **only resolved on exactly 1 match**, else ambiguous chip-selector; **never invents**.

### 7.7 Narration & memory
`narration.ts`: `classifyMeaning(medical|social|administrative|optional)`, `classifyPriority(critical|high|normal|low)`, `getSuggestion/getPreEventHint/getPostEventFollowUp/getProactiveNudge`, `narrateDay/narrateRange/shouldSpeak`. `abuTimeMemory.ts`: behavior log for predictive nudges (pattern prediction, personal reminders, notify-contacts).

### 7.8 Diagnostics
`voiceTrace.ts`: immutable per-turn trace (recording/transcription/semantics/decision/UI) with timestamped `steps[]`; `SemanticRoute = appointment_create|reminder_create|calendar_query|family_query|correction|cancel|unknown`. Always renders a visible message (no silent voice failure). Golden/harness tests `diagnostics/voicePipelineGolden`, `voicePipelineHarness`.

---

## 8. Serverless API contracts & security

All Edge runtime (`export const config = { runtime: 'edge' }`).
- **`api/abuai-chat.ts`** — POST `{body(OpenAI request), stream?, lang?}`. Reads `process.env.OPENAI_API_KEY` **only** (no VITE fallback). Missing→JSON `OPENAI_API_KEY_MISSING` (never streams). 25s timeout. Streaming passes SSE through (`X-Accel-Buffering:no`); non-streaming wraps `{ok:true, openai}`. Errors `CHAT_PROVIDER_FAILED|CHAT_TIMEOUT|BAD_REQUEST`, trilingual `userMessage`.
- **`api/abuai-online.ts`** — POST `{query,lang,kind?,locationHint?}`. `OPENAI_API_KEY ?? VITE_OPENAI_API_KEY`. Server personal-guard. OpenAI Responses + web_search. 12s timeout.
- **`api/abuai-stt.ts`** — POST multipart. Reads `OPENAI_API_KEY` **only**. `isPlaceholderKey()`→503 `OPENAI_API_KEY_INVALID` (no upstream call). 401/403→`OPENAI_API_KEY_INVALID`, else `STT_PROVIDER_FAILED`. Whisper-1.
- **`api/health.ts`** — GET; returns `{ok, buildVersion('0.5.0-production-candidate'), env{OPENAI_API_KEY:'present'|'missing'}, routes{...voiceTranscribe:'client_direct_groq'}}`. **Never returns the key value.**
- ⚠️ **Contract asymmetry:** chat + stt require `OPENAI_API_KEY`; online accepts `VITE_OPENAI_API_KEY` too. If only `VITE_OPENAI_API_KEY` is set in the environment, online works but chat/stt return key-missing. (Found and worked-around in the live-gate runs.)

---

## 9. Error handling & mediation

`errorMediation.ts`: `ErrorCategory = quota|network|timeout|mic-denied|mic-missing|speech-not-understood|auth|rate-limit|unknown`; `ErrorAction = retry|home|whatsapp-leo|dismiss`; `MediatedError {category,emoji,message(≤8 Hebrew words),primaryLabel,primaryAction,secondaryLabel?,secondaryAction?}`. `classifyError(err,status?)` (DOMException + HTTP status + text patterns + `navigator.onLine`). `mediateVoiceCaptureError(err,phase)`. `executeErrorAction` (`whatsapp-leo`→opens family WhatsApp group, no phone stored). `ErrorBoundary` class component → "משהו לא עבד" + back-home / full-refresh. **No raw provider/stack text ever shown** (verified `providerErrorMapping.test.ts`).

---

## 10. Other screens (brief)

- **Home:** 9 service tiles, location picker (share via WhatsApp), Martita photo rotation, time-based greeting, same-tab nav guard.
- **Opening/Offline/Error:** transitional screens tied to nav state / `lastError`.
- **Admin:** PIN setup/verify (SHA-256), lockout ≥5 attempts (reload-only reset), service editor, backup/restore, diagnostics; renders skeleton until `adminInitComplete`.
- **Settings:** WhatsApp link, quotes, contacts, backup/restore, version, location history, **hardcoded emergency numbers (101/100/102/*3066)**.
- **AbuWhatsApp** (`service.ts`): Groq/Gemini/OpenAI client-side; system prompt built from 1,388 real Martita WhatsApp messages; **mandatory authentic "errors"** (מאכלת, prefix spacing, doubled letters, "Ja ja" not חחח); styles מקורי/בדיחה/חידה/טריק; variety seeds.
- **AbuGames / AbuWeather / FamilyGallery:** lazy screens (out of audit scope per instruction — Games explicitly excluded).

---

## 11. Test & verification posture (what's proven vs not)

- **HIGH (executed):** tsc clean; **4570 unit/integration tests / 0 fail / 165 files**; build+PWA; persistence e2e (migrate→evict→restore) passed; online grounding+freshness **live on deployed Edge** with real sources; deterministic family/calendar/continuity/Spanish-shaping/trust/voice-key-safety. 0 `.skip`/`.todo`.
- **MED (deterministic, stub LLM):** companion planning (companionBrain 17/17), long-context (longContext 20/0, continuity20 12/12), martitaCompanion 12 scenarios avg 3.00/3 hard-fails 0, Spanish shaping 11/11. These prove the *machinery*, not real-model prose.
- **LOW (unproven — needs real model/device/user):** real-model Hebrew warmth; **conversational Rioplatense Spanish**; emotional/companion feeling; voice STT/realtime/TTS on Martita's device; Martita satisfaction.
- Acceptance docs: `PRODUCTION_ACCEPTANCE_DASHBOARD.md` (blended ~78%, eng floor ~97%), `FINAL_GO_NO_GO.md`, `LEO_FINAL_PILOT_SCRIPT.md`, `MARTITA_PASS_FAIL_SCORECARD.md`.

---

## 12. Security & privacy posture

- **OpenAI key server-only** for chat/stt (never in client bundle). ✅
- ⚠️ **Groq + Gemini keys are `VITE_*`** → **embedded in the client bundle** and extractable by anyone with the deployed JS. Also `VITE_OPENAI_API_KEY` and `VITE_AZURE_TTS_KEY` exist in `.env`; if shipped, those are client-exposed too. **This is the single biggest security exposure** — see §13 F-SEC1.
- Health endpoint leaks only presence booleans. ✅
- Privacy rules followed: city-level only (Kfar Saba), no phone numbers in memory, no medical/financial storage, WhatsApp **group** link (not personal numbers).
- PIN hashed SHA-256; lockout reload-only (usability vs security trade-off).
- No analytics/third-party trackers observed. All data local (localStorage/IndexedDB); no cloud sync (privacy plus, resilience minus).

---

## 13. Consolidated defect / contradiction / TODO register

> **RUN-3 CLOSURE STATUS (2026-06-22).** The release blockers below were addressed; the table that follows is the original finding for traceability.
> - **F-D1 (memorial date) — FIXED in runtime.** The SYSTEM_PROMPT no longer hardcodes "26 בדצמבר"; it now defers the memorial date to the `get_memorial_for` tool, which reads `family_data.json` (01-01). The two `.claude/rules` files no longer hardcode a date. Locked by `memorialDatePromptContract.test.ts` (asserts no Dec-26 in the prompt; `getMemorialFor('פפי')` → "1 בינואר"). **Residual = a soft Leo confirmation** of the real-world date (runtime is now self-consistent at the 01-01 source of truth; if the true date differs, Leo updates `family_data.json` only and everything follows).
> - **F-SEC1 (client-exposed billable keys) — FIXED.** All 5 client reads of billable `VITE_OPENAI_API_KEY` removed → server-proxied via new `api/abuai-tts` + `api/realtime-token` and existing `api/abuai-chat`. Enforced by `clientProviderKeyContract.test.ts` (blocks `VITE_OPENAI_API_KEY`/`VITE_AZURE*` in client src). Env contract: `docs/abuai/ENV_CONTRACT.md`. Groq/Gemini remain client-side free-tier by documented policy.
> - **F-SP1 (spend persistence) — REFRAMED, no code change.** The spend guard is *intentionally* contract-only (`jointOptimizationContract.test.ts:287` locks it out of `index.tsx`). So caps are **not enforced at runtime at all** (nothing passes live usage) — there are no counters to "reset on reload." Enforcing caps is a deferred product decision for Leo, not a code defect. For a *supervised* pilot, spend is observable/stoppable; enforce before any unsupervised/public use.
> - **F-V1 (version identity) — REFRAMED + FIXED.** The package-semver≠visible-version split is **by design** (`version.test.ts` locks `APP_VERSION.version` as the only visible version and forbids `30.10.0` in UI; `health.ts` already matched). Fixed the genuinely stale `buildDate`/`branchHint`; added a test locking `api/health.ts` `BUILD_VERSION`===`APP_VERSION.version` so the manual sync can't drift.
> - **F-OM1 (Open-Meteo weather) — REFRAMED, no code change.** `realtimeCheapSourceRouter` (with the TODO) is **not wired into `index.tsx`** — contract-only. Live weather flows through `answerOnlineCurrentInfo → /api/abuai-online → web_search` (proven live with sources). Weather is **in pilot scope and functional**; Open-Meteo is a non-blocking cost optimization in unwired code.


| ID | Severity | Item | Where | Impact | Fix owner |
|----|----------|------|-------|--------|-----------|
| **F-D1** | **P1 (emotional)** | Pepe memorial date contradiction: `family_data.json`+`birthdays_registry.yaml`=**01-01**; `.claude/rules/*`=**12-26**; **AND the AbuAI SYSTEM_PROMPT says "memorial 26 Dec"** | service.ts SYSTEM_PROMPT, rules, vs data | The **live LLM path could tell Martita Dec 26** while calendar uses Jan 1 — a wrong memorial date is an emotional hard-fail | Leo decision (`LEO_DATA_DECISIONS.md` D-1) then align prompt+rules to the data |
| **F-D2** | P1 (family-trust) | `birthdays_registry.yaml` labels Yarden "Ofir's wife"; source of truth = **Eili's wife** (Ofir's spouse is Gilad). Birthday `10-12` absent from source | birthdays_registry.yaml:117-122 | Wrong relation surfaced in a birthday reminder; validator doesn't scan this file | Leo (`LEO_DATA_DECISIONS.md` D-2) |
| **F-SEC1** | **P1 (security)** | Groq/Gemini (and any shipped `VITE_OPENAI/AZURE`) keys are bundled client-side | `.env` `VITE_*`, client fallback providers | Key exfiltration / quota abuse from public JS | Move all model calls server-side, or accept free-tier-only client keys with tight quotas |
| **F-SP1** | P2 | Spend-guard counters not persisted | aiSpendGuard.ts:13-14 TODO | Daily $3 / search / voice caps reset on reload → bypassable | Persist counters via `durableStore` |
| **F-V1** | P2 | Version identity mismatch | package.json `30.10.0` vs version.ts/health `0.5.0-production-candidate`, stale branchHint | Operator/QA confusion; stale-PWA detection unreliable | Single source the version |
| **F-OM1** | P2 | Open-Meteo weather fetcher not wired | realtimeCheapSourceRouter.ts:62 TODO | Weather always uses paid web_search instead of free API | Wire Open-Meteo or delete dead branch |
| **F-CACHE1** | P3 | Online cache in-memory only | onlineProvider.ts:15 | Cache lost each reload (extra spend) | Optional persistent cache |
| **F-FG1** | P3 | Family parent-backfill hardcoded | familyGraph.ts:140-151 | New family members need code change, not just JSON | Generalize backfill |
| **F-HIST1** | P3 | Only last ~50 chat messages persisted | index.tsx | Older context lost on long histories | Document/extend |
| **F-PARSE1** | P3 | Bare-word time after לפני/אחרי works for *reads* but not *create* phrasing | calendarCreate.parseHebrewTime | "קבע אחרי ארבע" → null (rare phrasing) | Low priority parser extension |
| **F-CONF1** | P3 | No appointment conflict prevention | service.ts (findConflicts exists, unused) | Double-booking possible | Optional enforce |
| **F-DEV1** | Info | `vercel dev` Edge fns 500 on outbound fetch (Node 24) | local only | Misleads local testing | Test against deploy URL (not a code bug) |
| **F-ASR1** | P3 | ASR confidence thresholds Hebrew-tuned | semanticIntent/calendarTranscribe | ES/EN may mis-gate | Calibrate per language |

Additional structural limitations (not bugs): no timezones (all local), no cross-device sync, reminder recurrence daily/weekly only, no end-time for appointments, no image/handwriting input, STT cooldowns reset on session restart, realtime `useRealtime=true` hard-coded in voice mode.

---

## 14. Critical findings for the reviewer (prioritized)

1. **F-D1 — memorial date is wrong in the live LLM instruction.** Highest-attention item: the conversational path can state Dec 26 while data says Jan 1. Until reconciled, do not run the emotional pilot block. *(This was discovered during this dossier's extraction; it elevates D-1 from doc cleanup to a runtime emotional-correctness defect.)*
2. **F-SEC1 — client-bundled provider keys.** The most serious *engineering/security* exposure. An external reviewer should treat this as a release blocker for any public deployment with billable keys.
3. **The real-user ceiling is unproven (LOW tier).** Spanish prose, companion warmth, and voice-on-device have **no** real-model/device evidence. The deterministic floor is strong but is not the product's felt quality. Do not accept any "green" claim on these without the pilot.
4. **Trust architecture is genuinely defended** (suppression rule + truth guard + honesty contract + composer + dual personal-block + round-trip save verification). A reviewer should validate these guards are *in the actual call path* (they are, per §6.2/§7.2) — this is the app's strongest property.
5. **Two version identities (F-V1)** and the **API key-name asymmetry (§8)** indicate config drift that bit the live-gate runs; worth a config audit.

---

## 15. Reviewer's question checklist (what to probe, and where the answer is)

- *Can the LLM ever assert a calendar/family fact without a tool run?* → §6.9 `containsUngroundedClaim`; verify it's called on the streaming path (§6.2 step 21). Expected: blocked unless `hadToolCall`.
- *Can a personal query leak to the web?* → §6.8 client `shouldBlockOnlineForPersonal` + §8 server guard (dual). Expected: no.
- *Can an appointment be saved silently / unverified?* → §7.2 `createAppointmentSafe` round-trip + §7.3 ConfirmCard P0. Expected: never silent; save verified by read-back.
- *Can a wrong-day or wrong-time answer occur?* → local-date handling (reminderStore `listToday`, calendar tools), `parseQueryBoundaryTime`; F-D1 is the open date risk.
- *What happens when all AI providers fail?* → §6.7 cooldown/force-add; §9 mediated error; STT exhaustion (§6.11). Expected: warm Hebrew error, never raw.
- *Is any secret exposed to the client?* → §12/F-SEC1. Expected concern: Groq/Gemini/VITE keys.
- *Does the spend cap actually cap?* → F-SP1. Expected: not across reloads.
- *Does persistence survive eviction?* → §4.1 e2e. Expected: yes (IndexedDB source of truth).
- *Is Rioplatense Spanish real or shaped?* → §11: shaping proven (MED), conversational unproven (LOW).
- *Is the family graph correct from Martita's POV?* → §5 + §6.6; verify D-2 and Ofir/gender coding ("Mor has no daughter — all sons").

---

## 16. Production-readiness summary

- **Engineering / deterministic floor:** strong and executed-green (~97%).
- **Real-user / live / voice / Spanish / companion feeling:** unproven (~40%) — only a supervised pilot moves these.
- **Blended:** ~78%. **Verdict: `READY_EXCEPT_LEO_AND_MARTITA_ONLY`** — code-side closed except the items in §13 that need Leo's decision (F-D1/F-D2), the security call (F-SEC1), the device pilot, and Martita's judgment. **Not full production before a passing pilot.**

*This dossier is self-contained for a code-blind deep review. Every claim carries a `file:line` or test/run anchor for spot-checking. Items not personally re-executed this cycle are marked MED/LOW; treat MED as "machinery proven, prose/UX not," and LOW as "unproven — must be validated live."*
