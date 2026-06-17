# CALENDAR_AUDIT — Phase 0 Forensic Audit

Branch: `feat/calendar-revolution` (base `feat/abuwhatsapp-local-family-contacts` @ 6a91ac5)
Scope: READ-ONLY forensic audit of `src/screens/AbuCalendar/**` and its integration with `src/screens/AbuAI/**`.
Status legend: claims carry `file:line` evidence. Where a pain point is already mitigated, this is stated explicitly with the mitigating citation.

---

## 1. File tree of `src/screens/AbuCalendar/**`

Non-test source files (line counts via `wc -l`):

| File | Lines | Purpose |
|---|---|---|
| `index.tsx` | 1310 | Main screen. Calendar grid, month nav, alert banners, voice record pipeline, modals, footer. The orchestrator of all calendar UX. |
| `service.ts` | 445 | State layer: `loadAppointments`/`saveAppointments`/`addAppointment`/`createAppointmentSafe`, family birthdays + memorials, Hebrew date/holiday formatters, LLM+local `parseAppointmentText`. |
| `localParser.ts` | 577 | Deterministic ES/EN/HE appointment parser (title/date/time/location/notes/ambiguity). |
| `VoiceCard.tsx` | 354 | Bottom-sheet draft editor shown after a voice parse: editable transcript + fields, save/cancel/retry, spoken read-back. |
| `AbuTime.tsx` | 322 | "מה קורה לי?" collapsible briefing card (today/week narration, suggestions, next event). |
| `narration.ts` | 287 | Day/range narration text, priority/meaning classification, pre-event hints, suggestions. |
| `ManualModal.tsx` | 254 | Manual add/edit modal. Required-field gate, sticky action bar. |
| `calendarTranscribe.ts` | 227 | Calendar-LOCAL Whisper transcription (`whisper-large-v3` + verbose_json + domain prompt + turbo fallback). |
| `semanticIntent.ts` | 212 | `extractCalendarIntentLocally` — local semantic intent extraction, validation result, `canAutoCreate`. |
| `voiceAutoCreate.ts` | 162 | `processVoiceTranscript` — transcript → one of 8 explicit actions (auto_created … failed_to_understand). |
| `correctionParser.ts` | 155 | Conversational correction parsing (`parseCorrection`/`applyCorrection`). |
| `voiceTrace.ts` | 153 | Voice diagnostic trace model + `serializeTrace`. |
| `VoiceTraceCard.tsx` | 146 | Always-visible voice-pipeline status/error card with copy-diagnostic button. |
| `calendarTranscriptCorrection.ts` | 116 | Deterministic domain correction of ASR output (family names / Israeli places). |
| `ApptCard.tsx` | 97 | Single appointment row (time-state styling, location/notes, delete). |
| `abuTimeMemory.ts` | 95 | Local memory of user actions on suggestions. |
| `intentParser.ts` | 76 | `isScheduleQuery` ("מה קורה לי?") detection. |
| `constants.ts` | 47 | Colors, day headers, date helpers, `getTimeState`, `isDuplicate`, `isFamily`. |
| `voiceReadbackGuard.ts` | 22 | `shouldShowConfirmationReadback` guard. |
| `voiceRecordGuard.ts` | 17 | `shouldBlockVoiceRecord` guard. |

Test files (not in revolution scope, but present): `calendarTranscribe.test.ts` (400), `voiceTrace.test.ts` (269), `localParser.test.ts` (277), `narration.test.ts` (270), `voiceAutoCreate.test.ts` (245), `voiceCardSlots.test.ts` (220), `createPipelineIntegration.test.ts` (208), `semanticIntent.test.ts` (203), `createReliability.test.ts` (189), `voicePersistence.test.ts` (182), `i18nParser.test.ts` (173), `service.test.ts` (166), `correctionParser.test.ts` (153), `voiceConfirm.test.ts` (129), `manualModalValidation.test.ts` (125), `intentParser.test.ts` (114), `voiceConfirmationP02.test.ts` (96), `voiceReadbackGuard.test.ts` (83), `voiceTranscriptionFailureCopy.test.ts` (83), `edgeCases.test.ts` (65), `voiceRecordGuard.test.ts` (62), `prediction.test.ts` (62), `timeState.test.ts` (45), `duplicateDetection.test.ts` (38). Total source+test ≈ 8931 lines.

---

## 2. Component hierarchy

```
AbuCalendar (index.tsx:62)
└─ PageShell scrollable (index.tsx:758 → components/PageShell/index.tsx)
   ├─ Alert banners  [position:fixed, top:72, zIndex:100]      (index.tsx:761-792)
   ├─ ScreenHeader  [header, position:relative, zIndex:20]     (index.tsx:794-835 → components/ScreenHeader/index.tsx)
   │  ├─ BackButton (left)                                      (index.tsx:796)
   │  └─ right: Martita photo + InfoButton                      (index.tsx:800-833)
   ├─ Alert-interval <select>                                   (index.tsx:838-858)
   ├─ AbuTime  [collapsible briefing]                           (index.tsx:861 → AbuTime.tsx:15)
   │  └─ SuggestionCard                                         (AbuTime.tsx:265)
   ├─ Month navigator (prev/next/“היום”)                        (index.tsx:864-923)
   ├─ Calendar grid  [overflow:hidden, backdropFilter]          (index.tsx:926-1051)
   │  ├─ Day headers row                                        (index.tsx:940-949)
   │  └─ Day cells (button per day, dots)                       (index.tsx:952-1050)
   ├─ Selected-day list  [maxHeight:200, overflowY:auto]        (index.tsx:1054-1086)
   │  ├─ Holiday chip                                           (index.tsx:1062-1071)
   │  ├─ EmptyState                                             (index.tsx:1074)
   │  └─ ApptCard × n                                           (index.tsx:1079 → ApptCard.tsx:5)
   ├─ Footer  [position:sticky, bottom:0, zIndex:20]            (index.tsx:1089-1152)
   │  ├─ StatusPill (recording/processing)                      (index.tsx:1099-1103)
   │  ├─ VoiceTraceCard                                         (index.tsx:1110 → VoiceTraceCard.tsx:28)
   │  └─ Action row: “＋ הוספה ידנית” + mic button              (index.tsx:1118-1151)
   ├─ Toast (delete-undo)                                       (index.tsx:1154-1161)
   ├─ Toast (save success/failure)                              (index.tsx:1163-1168)
   ├─ ManualModal  [position:fixed, zIndex:200]                 (index.tsx:1171-1178 → ManualModal.tsx:12)
   ├─ VoiceCard  [position:fixed, zIndex:200]                   (index.tsx:1180-1230 → VoiceCard.tsx:79)
   ├─ Ambiguity sheet  [position:fixed, zIndex:220]             (index.tsx:1232-1271)
   └─ <style> keyframes                                         (index.tsx:1274-1307)
```

---

## 3. State model

**localStorage keys:**
- `abubank-calendar-appointments` — array of `Appointment` (service.ts:1, written by `saveAppointments` service.ts:44-50).
- `abubank-alert-minutes` — reminder lead time (index.tsx:132, written index.tsx:845).
- `abubank-alerted-ids` — Set of already-fired alert ids (index.tsx:137-146).

**`Appointment` shape** (service.ts:3-17): `id, title, date(YYYY-MM-DD), time(HH:MM), emoji, color, notes?, location?, type?('regular'|'birthday'|'anniversary'|'memory'), personName?, birthYear?, isRecurring?`.

**Read/write functions (service.ts):**
- `loadAppointments()` service.ts:32-42 — JSON.parse with try/catch, returns `[]` on any failure.
- `saveAppointments(appts)` service.ts:44-50 — `setItem`, swallows storage errors silently.
- `addAppointment(appt)` service.ts:52-63 — assigns `id` (`appt-${Date.now()}-${random}`) + cycling `color`, appends, saves, returns the created appt. NOTE: `colorIndex` (service.ts:30) is module-global and resets to 0 on reload — colors are not stable across sessions.
- `createAppointmentSafe(input)` service.ts:85-117 — the single safe create path. (1) required-field validation; (2) format validation `DATE_RE`/`TIME_RE` (service.ts:82-83) + numeric range checks; (3) `addAppointment` in try/catch → `storage_failed`; (4) **round-trip read-back** (service.ts:113-114) re-reads storage and confirms the id is present, else `storage_failed`. Returns `{ok:true, appointment}` | `{ok:false, code}`.
- `updateAppointment(id, updates)` service.ts:169-172; `deleteAppointment(id)` service.ts:174-177.
- `loadAppointmentsWithFamily(viewYear?)` service.ts:375-395 — merges `FAMILY_BIRTHDAYS` (service.ts:344-367) + `FAMILY_MEMORIALS` (service.ts:369-372) regenerated for the viewed year, de-duped against user appts by id.

**Truth contract:** `createAppointmentSafe` is the ONLY write path for new events used by both manual save (index.tsx:265) and voice confirm (index.tsx:684) and the auto-create branch (voiceAutoCreate.ts:148). `addAppointment` is also called directly by the undo path (index.tsx:295) bypassing validation — acceptable since it re-adds an already-valid event.

**SOURCE-OF-TRUTH drift flag:** Family birthdays/memorials are HARD-CODED in `service.ts:344-372`, not read from `knowledge/family_data.json`. CLAUDE.md states family data must come from that JSON. This is a pre-existing governance drift; flagging for human review, not changing here.

---

## 4. Entry / exit points

- **Entry from Home:** Home footer nav button, `onClick={... item.id==='calendar' ? () => setScreen(Screen.AbuCalendar) ...}` (Home/index.tsx:624). Tile defined Home/index.tsx:748 (`id:'calendar'`, label `Abu יומן`).
- **Lazy mount:** `App.tsx:27` `lazy(() => import('./screens/AbuCalendar'))`; rendered at `App.tsx:63` `case Screen.AbuCalendar` inside `<Suspense><ErrorBoundary>`.
- **Exit:** `BackButton onPress={() => setScreen(Screen.Home)}` (index.tsx:796). No deep-links out to service URLs from the calendar today.
- **Cross-screen voice dependency:** calendar imports `getSupportedMimeType` (index.tsx:34), `shapeCreateConfirmReadback` (index.tsx:42), `pickUpdateAck`/`CANCEL_RESPONSE`/`UNRELATED_RESPONSE`/`pickClarifyQuestion` (index.tsx:46) from AbuAI. These are read-only consumers of AbuAI.

---

## 5. Reproduction recipes for PP-1 and PP-2 (today)

### PP-1 — added reminders/events visually covered by other elements
**Partially mitigated, partially live.**
- Mitigated for the **selected-day list**: after a create, the view jumps to the new event's date (index.tsx:274, 533, 693) so the event is at least selected. A success Toast also fires (index.tsx:280).
- STILL LIVE: the selected-day appointment list is constrained to `maxHeight: 200, overflowY: auto` (index.tsx:1054) and sits directly above a `position: sticky; bottom: 0; zIndex: 20` footer with a top-fading gradient + blur (index.tsx:1089-1097). On a 360×740 viewport with the AbuTime card expanded and 3+ events on a day, the **last appointment row is overlapped by the sticky footer gradient**, and only ~200px of list is visible so newly added later-in-the-day events require scrolling a small inner box. Repro: select a day with 4 events, add a 5th via mic at a late hour; the new `ApptCard` (index.tsx:1079) renders at the bottom of the 200px box behind the footer fade.
- ALSO LIVE: alert banners use `position: fixed; top: 72; zIndex: 100` (index.tsx:762). They overlay the alert-interval selector (index.tsx:838) and the top of the AbuTime card (index.tsx:861) when an alert fires — content covered by the banner.

### PP-2 — mic + manual-entry affordances take too much real estate
**Live.** The footer action row stacks: StatusPill (index.tsx:1099), a full VoiceTraceCard (index.tsx:1110, up to ~5 rows tall, VoiceTraceCard.tsx:52-145), then the action row with a text "＋ הוספה ידנית" SeniorButton + a 60px mic button (index.tsx:1118-1151). On an active voice session the footer can occupy ~40% of vertical space, and because it is `position: sticky` it permanently consumes the bottom band even when idle (the action row + safe-area padding, index.tsx:1092). The VoiceTraceCard is always-rendered while a trace is non-idle (VoiceTraceCard.tsx:30-32), compounding the footprint.

---

## 6. PP-1 root-cause investigation

**(a) Stacking-context collisions from transform/filter/will-change/position:fixed/backdrop-filter ancestors.**
PRESENT and causal. The calendar creates multiple stacking contexts:
- `backdropFilter: blur(20px)` on the grid container (index.tsx:932) and footer (index.tsx:1095), header (ScreenHeader/index.tsx:21).
- `position: fixed` alert banner zIndex:100 (index.tsx:762) vs `position: sticky` footer zIndex:20 (index.tsx:1090) vs ScreenHeader zIndex:20 (ScreenHeader/index.tsx:26) vs modals zIndex:200/220 (ManualModal.tsx:75, VoiceCard.tsx:132, index.tsx:1239).
- The z-index ladder is internally consistent for modals (200/220 > everything), BUT the alert banner (fixed, z100) deliberately floats over header (z20) and content — this is the mechanism by which an alert covers the selector/AbuTime. The footer (sticky, z20) with its gradient covers the bottom of the scrollable list (the list has no z-index and no bottom padding to clear the footer). This is the concrete current cause of "added event covered."

**(b) Overflow clipping on the grid/scroll container.**
The grid uses `overflow: hidden` (index.tsx:936) but its children are only day-cells + 6px dots — nothing extends beyond, so the grid does not clip events. The clipping that matters is the **selected-day list** `maxHeight:200; overflowY:auto` (index.tsx:1054): it does not clip content (it scrolls), but it limits the visible window so a freshly added event can be below the fold. Not a clip bug; a sizing/no-scroll-violation issue (see §10).

**(c) position:sticky in chrome.**
PRESENT and causal for the bottom overlap. Footer `position: sticky; bottom: 0` (index.tsx:1090) with `background: linear-gradient(to top, rgba(5,10,24,0.97) 60%, ...)` + blur (index.tsx:1094-1095) draws over whatever scrolls beneath it. The selected-day list directly precedes the footer with no spacer, so its last rows render behind the footer fade. This is the single clearest current cause of PP-1's "covered by other elements."

**(d) iOS Safari border-radius + overflow clip bug.**
The grid has `borderRadius: 20` + `overflow: hidden` (index.tsx:933, 936) and AbuTime has `borderRadius: 18` + `overflow: hidden` (AbuTime.tsx:106). On iOS Safari, `border-radius` + `overflow:hidden` + an internally transformed/animated child can drop the clip or repaint incorrectly. The grid's children animate (`fadeSlideUp`, `todayShimmer` index.tsx:974, 1015) inside the rounded clip — a known iOS repaint-flash risk. No direct evidence of event-covering from this; flag as MEDIUM hypothesis requiring on-device verification.

**Current cause summary:** PP-1 today is primarily (c) the sticky blurred footer overlapping the bottom of a height-capped scroll list, plus (a) the fixed alert banner overlaying top chrome. (b)/(d) are not confirmed event-coverers on current code; (d) requires device proof.

---

## 7. Abu AI surface map (calendar-relevant)

The calendar does NOT use AbuAI's transcription — it has its OWN path (see flow below). AbuAI exports actually consumed by the calendar:

| Export | File:line | One-line purpose | Current API shape |
|---|---|---|---|
| `getSupportedMimeType` | re-exported AbuAI/service.ts:516 (from services/recording) | Pick a MediaRecorder mime type | `() => string \| ''` |
| `shapeCreateConfirmReadback` | responseShaper.ts:174 | Spoken Hebrew read-back of a draft before confirm | `(draft: ReadbackDraft) => string`; `ReadbackDraft = {title, personName?, date, time, location?, notes?, ambiguousTime?}` (responseShaper.ts:164-172) |
| `pickUpdateAck` / `pickClarifyQuestion` / `CANCEL_RESPONSE` / `UNRELATED_RESPONSE` | conversationLayer.ts:28/15/9/11 | Correction-flow acknowledgement + clarify strings | string helpers |

AbuAI's own transcription + create (present, NOT used by calendar runtime path):
- `transcribeAudio(audioBlob)` AbuAI/service.ts:454-514 — Groq Whisper (`WHISPER_MODEL`, turbo-tier), `json` format, 12s timeout, language from `abu-voice-lang` localStorage. Returns `Promise<string>` (text only, no confidence metadata).
- `calendarCreate.ts` (AbuAI/calendarCreate.ts) — full Hebrew create state machine: `isCreateIntent` (:87), `parseCreateIntent` (:370), `startCreate`/`updateCreate`/`resolvePendingMessage` (:392/:403/:489), `parseHebrewTimeDetailed` (:143), `parseCreateDate` (:257), `extractTitle` (:337). This is the AbuAI chat-driven create path; the calendar screen does NOT call it (it uses `voiceAutoCreate.processVoiceTranscript` instead).
- `dateParser.parseHebrewDate` (dateParser.ts:49), `parseHebrewMonth` (:102).

**Calendar's own voice→intent flow (the live path):**
`handleVoiceRecord` (index.tsx:329) → MediaRecorder onstop (index.tsx:380) →
1. `transcribeCalendarAudio(blob, {languageHint:'he'})` (index.tsx:407 → calendarTranscribe.ts:187) — `whisper-large-v3`, `verbose_json`, temperature 0, Hebrew domain prompt (calendarTranscribe.ts:39-45), 18s timeout, turbo fallback only on 429/5xx (calendarTranscribe.ts:216-225). Returns `{text, rawText, model, languageHint, asrFallbackUsed, avgLogprob?, noSpeechProb?, compressionRatio?}` (calendarTranscribe.ts:78-93).
2. `normalizeCalendarTranscript(rawText)` (index.tsx:417 → calendarTranscriptCorrection.ts) — deterministic family-name/place correction; returns `{corrected, rawText, correctionsApplied}`.
3. `processVoiceTranscript(transcribed, todayISO, {rawTranscript, asr})` (index.tsx:524 → voiceAutoCreate.ts:114) — runs `extractCalendarIntentLocally` (semanticIntent.ts:129) + `parseLocally`, returns one of 8 actions.
4. `createAppointmentSafe(...)` (voiceAutoCreate.ts:148 → service.ts:85) on the `auto_created` path; otherwise the UI shows confirm/clarify/am-pm/failure cards.

**Comparison to target contract** `request {rawTranscript, contextDate, locale} → response {status, reminder?, confidence, alternatives?, failureReason?}`:
- The calendar's de-facto request is `processVoiceTranscript(transcript, todayISO, {rawTranscript, asr})` — has `rawTranscript` and a context date (`todayISO`), but **no explicit `locale`** (language is inferred per-helper, e.g. clarifyQuestion voiceAutoCreate.ts:83-104).
- The de-facto response is the `ProcessAction` union (voiceAutoCreate.ts:72-81): 8 variants `not_calendar | low_confidence | auto_created | show_confirm_card | needs_am_pm | needs_clarification | failed_to_save | failed_to_understand`. It carries a `semantic` payload with `extractionConfidence`/`confidence` (semanticIntent.ts:160-165) ≈ the target `confidence`, and `failed_to_*`/`reason` ≈ `failureReason`. There is **no `alternatives?`** field, and no single `reminder?` object (it returns either an `appointment` on success or a `draft`). The target contract would require a thin adapter; the building blocks (confidence, failure reason, structured draft) already exist.

---

## 8. Existing feature surface for due-date semantics (service launcher)

The Home service launcher is defined by `Service` (Home/data.ts:3-10) with fields `{id, label, url, color, logo, bgColor}` and the 9 entries: `mizrahi, postal, max, water, iec, arnona, hot, partner, yes` (Home/data.ts:12-22).

**Finding: NONE of the service entries carry any due-date, billing-cycle, or appointment semantics.** The `Service` interface has no date/amount/dueDate field (Home/data.ts:3-10). The only billing references are decorative copy strings in `MSGS` and `getDailyMsg` (Home/data.ts:24-52, e.g. `'כבר שילמת את הארנונה? 🏠'` :29, `'תחילת חודש — כדאי לבדוק חשמל ומים 💡'` :50) — these are static rotating messages, not structured data. There is therefore **no existing structured source** to feed a one-tap "add bill due-date as reminder." Building that would require new data (per-service billing dates), which does not exist today.

---

## 9. Recent calendar commits (trajectory)

`git log --since='90 days ago' --oneline -- src/screens/AbuCalendar/` (most recent first):

The trajectory is a P0.x voice-reliability hardening series layered on top of an earlier premium-visual rebuild:
- Visual rebuild slices: `acc7223` (shared design rebuild), `d58b9b6` (cleanup 1+2), `57106a1` (footer + recording UX slice 3), `47df665`/`7d62c24` (premium visual upgrade v30.10.0).
- Voice create v3 + correction flow: `914cb07` (deterministic Hebrew parser), `ae9e7a7`/`276da73`/`ddc7abe` (conversational correction), `310f555` (state machine), `5084a9e` (shapeCreateConfirm wiring), `f82c29c` (voice-confirm save + JUL-17 emoji fix).
- The P0 reliability series: `f0a9779` (P0: safe creator + honest UX), `ab795e2` (P0: deterministic ES/EN parser + ManualModal validation), `cc22151` (P0.1: voice recording E2E recovery), `6802277` (P0.5: visible transcription-failure copy), `8e08a69` (P0.6: visible record/stop trace), `86b5f50` (P0.7: large-v3 + domain prompt + correction layer), then P0.2 confirmation-persistence (`798c0c6`/`255015f`/`8b527be`), `3b1d680` (unify voice error mediation across AbuAI+AbuCalendar), `b91306b` (P0.8 semantic intent rebase), `1494d47` (improve Hebrew voice intent extraction), `8fd0381` (enforce operational calendar AI contract).

**Summary:** the recent 90 days moved from "make it pretty" to "make voice create honest and never silently fail" — every P0.x step added visible state/error feedback and a safe-create round-trip. The reliability scaffolding (trace card, safe creator, semantic intent, correction flow) is mature; the OPEN gaps are layout/real-estate (PP-1/PP-2) and feature breadth, not voice reliability.

**Candidate "new abilities" the revolution could add (for operator confirmation):**
1. Bill/service due-date reminders — one-tap "add as reminder" from the service launcher (requires NEW per-service date data; none exists today, §8).
2. Recurring user reminders (medication, weekly calls) — `isRecurring` field exists (service.ts:16) but only family birthdays use it; no user-facing recurring create.
3. Family-event sourced reminders read from `knowledge/family_data.json` instead of hard-coded `FAMILY_BIRTHDAYS` (fixes the §3 governance drift).
4. A unified voice contract adapter (`{rawTranscript, contextDate, locale} → {status, reminder?, confidence, alternatives?, failureReason?}`, §7) so calendar + AbuAI share one create surface.
5. Layout revolution to eliminate PP-1/PP-2: no-scroll primary view, footer that does not overlap the event list, compact mic/manual affordance.
6. "Next thing" / agenda glance surfaced without expanding AbuTime.
7. Shabbat/holiday-aware scheduling nudges (holiday table already present, service.ts:409-444).

**Operator: please confirm or extend this candidate list.**

---

## 10. Heuristic + WCAG 2.2 AAA findings

Severity 1 (cosmetic) – 4 (critical). Hit-target target ≥56pt recommended / ≥64pt aspirational per project senior-ux rule.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| H1 | 3 | **No-scroll-on-primary violated.** `PageShell scrollable` (index.tsx:758) makes the whole primary calendar screen scroll, contradicting CLAUDE.md "No scroll on primary screens." The selected-day list adds a second nested scroll (`overflowY:auto`, index.tsx:1054). | index.tsx:758, 1054 |
| H2 | 3 | **Sticky footer overlaps content (PP-1).** Footer `position:sticky;bottom:0` + blurred gradient draws over the bottom of the event list, no spacer. | index.tsx:1089-1097 |
| H3 | 2 | **Fixed alert banner overlays top chrome (PP-1).** `position:fixed;top:72;z100` covers the alert-interval selector + AbuTime header. | index.tsx:762 |
| H4 | 2 | **Hit target below 56pt minimum.** Day cells `minHeight:54` (index.tsx:973) — below the project 56pt recommendation, near the 48pt floor; with `gap:3` (index.tsx:952) effective spacing is <12pt between targets (project rule: spacing ≥12pt). | index.tsx:952, 973 |
| H5 | 2 | **Small dismiss target.** VoiceTraceCard dismiss button `minWidth/minHeight:36` (VoiceTraceCard.tsx:77) — below 48pt floor and 56pt rec. | VoiceTraceCard.tsx:77 |
| H6 | 2 | **Contrast below AAA.** Multiple labels at `rgba(201,168,76,0.55)` on dark (e.g. alert-select label index.tsx:842; "אירועים" header index.tsx:1058 at 0.70) and `rgba(245,240,232,0.50)` (index.tsx:944, 1059). At these alphas the effective contrast is well under the AAA 7:1 (and likely under AA 4.5:1) for the small 13-16px text. Project rule cites 4.5:1 min; AAA target unmet. | index.tsx:842, 944, 1058, 1059 |
| H7 | 2 | **Color-as-only-indicator risk.** Calendar dots distinguish event types ONLY by color (gold vs pink vs grey, index.tsx:1034-1045) with no shape/text pairing — violates project "no color-only indicators." The InfoButton legend (index.tsx:813-823) documents this but the cells themselves are color-only. | index.tsx:1033-1045 |
| H8 | 1 | **Tiny diagnostic text.** Trace metadata row 11px (VoiceTraceCard.tsx:118), DEBUG block 12px (VoiceCard.tsx:287), "לפני תיקון" 11px (VoiceTraceCard.tsx:113) — below 16pt body minimum (dev/diagnostic, so low severity). | VoiceTraceCard.tsx:113,118; VoiceCard.tsx:287 |
| H9 | 2 | **Visibility-of-state partially good but crowded (PP-2).** State is well-surfaced (StatusPill index.tsx:1099, VoiceTraceCard index.tsx:1110, voice-state badge VoiceCard.tsx:154) — Nielsen H1 satisfied — but the stacking consumes excessive footer real estate. | index.tsx:1099-1151 |
| H10 | 1 | **RTL correctness mostly good.** Modals/cards set `dir="rtl"` (ManualModal.tsx:88, VoiceCard.tsx:137, VoiceTraceCard.tsx:55) and time inputs correctly force `dir:ltr` (ManualModal.tsx:177, VoiceCard.tsx:252). PageShell default `dir:rtl`. No RTL defect found; noted as GOOD. | PageShell/index.tsx:11; VoiceCard.tsx:252 |
| H11 | 2 | **Hebrew typography — line-through on past events reduces legibility.** Past appt titles get `textDecoration:line-through` (ApptCard.tsx:69) over 16px Hebrew — strikethrough on Hebrew at 16px harms readability for presbyopia. | ApptCard.tsx:69 |
| H12 | 2 | **Error recovery good (Nielsen H9).** Honest failure copy in plain Hebrew throughout (e.g. index.tsx:390 'לא נקלט שמע בהקלטה. נסי שוב קרוב יותר למיקרופון.', 621 'לא שמעתי מספיק ברור. תוכלי להגיד שוב?'); `formatCreateFailure` (service.ts:132) avoids technical jargon. Noted as GOOD. | index.tsx:390, 621; service.ts:132 |

**What is already good (do not "fix"):** the safe-create round-trip (service.ts:113), always-visible voice trace (VoiceTraceCard.tsx:30), honest Hebrew error copy (index.tsx:633-660), the no-silent-Stop trace (index.tsx:332-358), RTL discipline (H10), and required-field gating in both ManualModal (ManualModal.tsx:35) and VoiceCard (VoiceCard.tsx:123).

---

*End of Phase-0 audit. No source files other than this deliverable were modified.*
