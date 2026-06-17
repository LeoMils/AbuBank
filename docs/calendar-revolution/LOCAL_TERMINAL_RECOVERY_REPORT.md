# LOCAL TERMINAL RECOVERY REPORT

## Context
- **Branch**: `feat/calendar-revolution`
- **Starting HEAD**: `65b2b5e`
- **Final HEAD**: (pending commit)
- **Date**: 2026-06-01

## Baseline (before changes)
- Typecheck: CLEAN
- Tests: 2471 passed (109 files)
- Build: SUCCESS

## Final State (after changes)
- Typecheck: CLEAN
- Tests: 2494 passed (109 files) — **+23 new tests**
- Build: SUCCESS

## Files Changed (10 files, +243 / -9 lines)

| File | Change |
|------|--------|
| `src/screens/AbuCalendar/voiceTrace.ts` | P0: Added `correction`, `cancel` to SemanticRoute type; P3: added `audioDurationMs`, `sttStatus` fields |
| `src/screens/AbuCalendar/index.tsx` | P0: trace updated on cancel actions; P3: populate `audioDurationMs`, `sttStatus` |
| `src/screens/AbuCalendar/localParser.ts` | P1: midnight fractions (`חצות וחצי` → 00:30), `רבע לחצות` → 23:45, `רבע אחרי חצות` → 00:15 |
| `src/screens/AbuCalendar/localParser.test.ts` | P1: +13 tests for midnight fractions, quarter-to/after midnight |
| `src/screens/AbuCalendar/reminders/reminderParser.ts` | P1: compound relative time (`בעוד שעה ועשרים דקות` → +80 min) |
| `src/screens/AbuCalendar/reminders/reminderParser.test.ts` | P1: +4 tests for compound relative time, `בעוד 25 דקות` |
| `src/screens/AbuCalendar/familyResolve.ts` | P2: added `סבא`/`סבתא` (grandparent) resolution |
| `src/screens/AbuCalendar/familyResolve.test.ts` | P2: +10 tests for all required family resolution cases |
| `src/screens/AbuCalendar/ConfirmCard.tsx` | P4: replaced lonely "חסר" with explanatory text; added save-blocked explanation |
| `.claude/settings.local.json` | (auto — not committed) |

## Exact Fixes

### P0 — Semantic / QA trace consistency
- **SemanticRoute** extended with `correction` and `cancel` — the full allowed set is now: `appointment_create`, `reminder_create`, `calendar_query`, `family_query`, `correction`, `cancel`, `unknown`.
- Cancel handlers (`handleVoiceCancel`, `handleReminderCancel`) now update the trace with `semanticRoute: 'cancel'`.
- `show_confirm_card` was already never leaked to the route field (verified by existing e2e tests).

### P1 — Time parsing
| Input | Expected | Status |
|-------|----------|--------|
| `מחר בחצות וחצי פגישה עם אופיר` | tomorrow 00:30 | FIXED + tested |
| `בחצות וחצי` | 00:30 | FIXED + tested |
| `רבע לחצות` | 23:45 | FIXED + tested |
| `רבע אחרי חצות` | 00:15 | FIXED + tested |
| `12 וחצי בלילה` | 00:30 | Already worked, now pinned with test |
| `שתים עשרה וחצי בלילה` | 00:30 | Already worked, now pinned with test |
| `אחת וחצי בלילה` | 01:30 | Already worked, now pinned with test |
| `בעוד שעה ועשרים דקות` | +80 minutes | FIXED + tested |
| `בעוד 25 דקות` | +25 minutes | Already worked, now pinned with test |

### P2 — Family relations
| Input | Expected | Status |
|-------|----------|--------|
| `אשתו של אילי` | missing (אילי not a known alias) | Honest, tested |
| `אשתו של גלעד` | missing (Gilad's spouse is male) | Honest, tested |
| `אבא של אנאבל` | ambiguous (Ofir + Gilad) | Honest, tested |
| `אמא של אנאבל` | missing (both parents male) | Honest, tested |
| `הגרוש של מור` | resolved → רפי | Correct, tested |
| `הגרושה של מור` | missing (Rafi is male) | Honest, tested |
| `חברה של מור` | missing (no friend data) | Honest, tested |
| `חבר של מור` | missing (no friend data) | Honest, tested |
| `סבא של ארי` | resolved → רפי | **FIXED** + tested (grandparent added) |
| `סבתא של ארי` | resolved → מור | **FIXED** + tested (grandparent added) |

### P3 — Microphone reliability
- Added `audioDurationMs` and `sttStatus` fields to VoiceTrace.
- `audioDurationMs` computed from `startedAt` timestamp at blob creation.
- `sttStatus` set to `'ok'` | `'empty'` | `'error'` | `'timeout'` based on STT outcome.
- Full pipeline investigation documented below.
- **NEEDS_BROWSER_QA**: Silence cutoff timing, TTS-interrupts-recording, actual blob duration vs `audioDurationMs` (estimated from wall clock).

### P4 — Confirmation cards
- Replaced lonely "חסר" in missing time/date with contextual Hebrew guidance:
  - Both missing: "לא הבנתי מתי. תגידי יום ושעה."
  - Date only missing: "חסר יום — מתי?"
  - Time only missing: "חסרה שעה — באיזו שעה?"
- Added save-blocked explanation when primary button is disabled:
  - No title: "מה לרשום? תגידי מה הפגישה."
  - Other: "חסרים פרטים — תקני או תגידי שוב."
- Buttons already >=56px (verified).
- No raw transcript, no debug, no technical states in card.

### P5 — Reminder honesty
- **BLOCKER**: Reminders use `setInterval` polling in `ReminderDueEngine.tsx` — only fires while the tab is open and the component is mounted.
- No push notification, no service worker notification, no background scheduling.
- Medication reminders (`category: 'medication'`) CANNOT be relied upon when the phone screen is off or the browser tab is closed.
- Claiming closed-app reliability would be dishonest.
- To fix: requires service worker + Web Push API or native platform integration. Out of scope for this recovery.

## Microphone Pipeline Investigation (P3 Detail)

### Recording Pipeline
- **Start**: `getUserMedia()` with echoCancellation, noiseSuppression, autoGainControl
- **Recording**: `MediaRecorder` with 100ms chunk interval
- **Stop**: user tap → `recorder.stop()` → `onstop` event → blob assembly
- **Formats**: audio/mp4 (iOS) > audio/webm;codecs=opus (Chrome) > audio/ogg;codecs=opus (Firefox)

### Silence Detection
- `createSilenceDetector()` in `services/voice.ts`
- AudioContext + AnalyserNode for real-time audio analysis
- Noise floor calibration in first 500ms
- Quiet mode: threshold 25, 2.5s silence after speech, 15s max, 2s min active
- Noisy mode: threshold 40, 3s silence, 15s max, 2.5s min active
- Hard safety timer guarantees `onSilence()` after maxMs

### STT
- Primary: Groq Whisper API (large-v3 with Hebrew domain prompt)
- 12s timeout with AbortController
- Domain correction pass post-STT for family names and Israeli places

### TTS Interference
- TTS uses separate audio paths (HTMLAudioElement, Web Speech API, AudioContext)
- iOS audio unlock (`unlockIOSAudio()`) primes AudioContext before mic session
- `stopSpeaking()` stops all 4 TTS channels before recording starts
- **NEEDS_BROWSER_QA**: Whether TTS playback from a previous answer can overlap with a new recording session on slow devices

### QA Trace Fields Available
Pre-existing: `blobSize`, `chunksCount`, `mimeType`, `startedAt`, `stopPressedAt`, `onstopFired`, `recorderStateBeforeStop/AfterStop`, `transcribeStarted/Finished`, `transcriptLength`, `asrModel`, `avgLogprob`, `noSpeechProb`, `compressionRatio`
Added: `audioDurationMs`, `sttStatus`

## Remaining Blockers

1. **BLOCKER — Reminder reliability**: Reminders only work while tab is open. Medication reminders for an 80+ user CANNOT be trusted. Requires service worker or native integration.
2. **NEEDS_BROWSER_QA — Mic pipeline**: Silence cutoff timing, TTS interference, actual blob duration need live device testing.
3. **NEEDS_BROWSER_QA — ConfirmCard layout**: 360×740 viewport safety should be validated on real Galaxy S25 Edge.
4. **אילי alias**: "אילי" is a common spoken variant of "עילי" not in family_data.json aliases. Could be added to domain correction or family_data.json (blocked by "do not edit family_data.json" rule).

## Test Count
- Before: 2471 tests
- After: 2494 tests (+23)
- All passing

## Build / Typecheck Status
- **Typecheck**: CLEAN
- **Build**: SUCCESS
- **Tests**: ALL PASS

## Release Status
- **Browser QA allowed**: YES (safe to test on device)
- **Martita release allowed**: NO — reminder BLOCKER, mic QA pending
- **Pushed**: NO
