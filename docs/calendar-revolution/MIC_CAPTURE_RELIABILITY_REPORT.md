# MIC CAPTURE RELIABILITY REPORT

## Root Cause

Phone QA showed words lost in voice-to-calendar transcription. Forensic analysis
of the recording pipeline (`index.tsx` lines 299–755) identified two primary causes:

1. **No audio processing constraints**: Calendar used bare `getUserMedia({ audio: true })`
   while AbuAI voice mode uses `{ echoCancellation, noiseSuppression, autoGainControl }`.
   Background noise (TV, AC, street) overwhelmed the speech signal.

2. **No silence detection / no auto-stop / no max duration**: User had to manually
   tap stop. Too-quick taps cut sentences; too-late taps left long silence tails
   that caused Whisper to hallucinate or drop trailing words.

## Files Changed

| File | Change |
|------|--------|
| `src/screens/AbuCalendar/index.tsx` | Audio constraints, silence detection, min/max duration, stopReason trace, senior-friendly status copy |
| `src/screens/AbuCalendar/voiceTrace.ts` | Added `stopReason` field to VoiceTrace |
| `src/screens/AbuCalendar/micCapture.test.ts` | 21 new regression tests |
| `docs/calendar-revolution/MIC_CAPTURE_RELIABILITY_REPORT.md` | This report |

## Exact Fixes

### 1. Audio constraints (index.tsx)
```
BEFORE: getUserMedia({ audio: true })
AFTER:  getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
```

### 2. Min recording duration (1000ms)
- If user taps stop before 1000ms, recording continues until 1000ms.
- Status: "עוד רגע, אני מקשיבה..."
- stopReason: `min_duration_delay`

### 3. Max recording duration (22s)
- Auto-stop after 22 seconds.
- Status: "הבנתי, בודקת..."
- stopReason: `max_duration`

### 4. Silence detection
- Reuses `createSilenceDetector` from `services/voice.ts` (same as AbuAI).
- Config: threshold=25, silence=2500ms after speech, maxMs=22000, minActive=1500ms.
- Noise floor calibration in first 500ms (adapts to TV/AC).
- Does NOT stop during first 1.5s (prevents premature cutoff).
- After speech detected + 2.5s silence → auto-stop.
- Status: "הבנתי, בודקת..."
- stopReason: `silence_after_speech`
- Fallback: if AudioContext unavailable, max-duration timer is the safety net.

### 5. QA trace (voiceTrace.ts + index.tsx)
New `stopReason` field with values:
- `manual` — user tapped stop
- `min_duration_delay` — user tapped too quickly, delayed
- `silence_after_speech` — auto-stopped after silence
- `max_duration` — hit 22s limit
- `no_audio` — zero chunks / zero bytes
- `error` — recorder.stop() threw

### 6. MediaRecorder timeslice
Changed `mr.start()` → `mr.start(250)` for 250ms chunk intervals.
`chunksCount` now reflects actual recording duration (not always 1).

### 7. Senior-friendly status copy
- Recording: "אני מקשיבה..."
- Auto-stop: "הבנתי, בודקת..."
- Min-duration delay: "עוד רגע, אני מקשיבה..."

## What is PROVEN_BY_TEST

| Assertion | Test |
|-----------|------|
| getUserMedia uses echoCancellation + noiseSuppression + autoGainControl | micCapture.test.ts |
| No bare `{ audio: true }` in calendar recording | micCapture.test.ts |
| MIN_RECORDING_MS defined (800-1500ms) | micCapture.test.ts |
| Too-quick stop shows "עוד רגע, אני מקשיבה..." | micCapture.test.ts |
| Delayed stop sets stopReason=min_duration_delay | micCapture.test.ts |
| MAX_RECORDING_MS defined (18000-30000ms) | micCapture.test.ts |
| Max duration auto-stop sets stopReason=max_duration | micCapture.test.ts |
| Auto-stop shows "הבנתי, בודקת..." (2+ occurrences) | micCapture.test.ts |
| createSilenceDetector imported | micCapture.test.ts |
| Silence stop sets stopReason=silence_after_speech | micCapture.test.ts |
| SILENCE_AFTER_SPEECH_MS in 1500-3500ms range | micCapture.test.ts |
| SILENCE_MIN_ACTIVE_MS >= 1000ms | micCapture.test.ts |
| VoiceTrace has stopReason/audioDurationMs/sttStatus/blobSize | micCapture.test.ts |
| no_audio path sets stopReason | micCapture.test.ts |
| No raw transcript in ConfirmCard | micCapture.test.ts |
| MediaRecorder.start() called with timeslice | micCapture.test.ts |
| recorder_stop_threw error handling preserved | voiceTrace.test.ts |

## What NEEDS_BROWSER_QA

| Item | Why |
|------|-----|
| Actual noise suppression quality on Galaxy S25 Edge | Browser implementation varies |
| Silence detector threshold tuning in real rooms | Threshold 25 may need adjustment per device |
| Whether echoCancellation interferes with speakerphone recording | Some Android browsers conflict |
| Exact timing of auto-stop after speech ends | 2.5s silence threshold may feel too long or short |
| Min-duration delay UX — does "עוד רגע" confuse Martita? | Needs real-user observation |
| Full 10-sentence mic test below | End-to-end voice-to-card validation |

## 10 Mic Tests for Browser QA

For each test, capture from QA panel: stopReason, audioDurationMs, blobSize, chunksCount, sttStatus, transcript.

| # | Utterance | Expected |
|---|-----------|----------|
| 1 | תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר | appointment, 21:00, גלעד, save yes |
| 2 | תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי | appointment, 21:30, relation honest |
| 3 | מחר בחצות וחצי פגישה עם אופיר | appointment, 00:30, save yes |
| 4 | מחר ברבע לחצות פגישה עם אופיר | appointment, 23:45, save yes |
| 5 | תזכירי לי בעוד שתי דקות לקחת כדור | reminder, +2 min, save yes |
| 6 | בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה | reminder, correction → +2 min |
| 7 | תזכירי לי בעוד שעה ועשרים דקות להתקשר למשה | reminder, +80 min |
| 8 | מי הבעל של אופיר | family_query, no save |
| 9 | מה התוכניות שלי השבוע | schedule_query, no save |
| 10 | יש לי תור לרופא מחר בעשר בבוקר | appointment, 10:00, save yes |

For each: verify stopReason is `manual` or `silence_after_speech`, NOT `no_audio`.
Verify chunksCount > 1 (timeslice working). Verify transcript matches utterance.
