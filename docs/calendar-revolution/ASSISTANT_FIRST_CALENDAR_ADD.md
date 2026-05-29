# Assistant-First Calendar Add

## 1. Product correction: day-first → assistant-first

Previous design placed the mic button and "הוספה ידנית" exclusively inside
`DayDetailSheet footer`. That sheet renders `null` until the user taps a
calendar cell. Result: no path to add an event without first selecting a day.

Correct model: Martita speaks naturally from the main calendar screen.
The system listens, parses date/time/person from speech, and shows ConfirmCard
before saving. Selecting a specific day first is never required.

## 2. Files changed

- `src/screens/AbuCalendar/index.tsx` — added primary bottom action bar +
  spacer div
- `src/screens/AbuCalendar/calendarAddSurface.test.tsx` — updated test suite
  (36 tests)

## 3. Where main-screen mic/add is rendered

A fixed bottom action bar (`data-testid="main-add-bar"`) is rendered at:
```
position: fixed; bottom: 0; left: 0; right: 0; zIndex: 100
```

Rendered when `!sheetOpen`. When DayDetailSheet opens, its scrim (zIndex 150)
naturally covers the bar; hiding it via `!sheetOpen` keeps the DOM clean.

Contents:
- `SeniorButton` "＋ הוספה ידנית" (secondary, opens ManualModal)
- 64×64 circular gold mic button (`data-testid="main-mic-btn"`,
  `aria-label="הוספת אירוע בקול"`)
- Label "דברי אליי" beneath the mic

A spacer `<div style={{ height: 88 }} />` is added before DayDetailSheet so
the fixed bar never covers the last calendar row when scrolled to the bottom.

## 4. How main-screen voice works without selected day

`handleVoiceRecord()` starts MediaRecorder, transcribes via Groq Whisper,
runs `processVoiceTranscript(transcribed, today)`. The `today` value comes from
`getTodayStr()`. `selectedDay` is never passed to the voice pipeline.

The parser extracts date from speech ("מחר", "יום שישי", "ב-15 ביוני", etc.)
using Hebrew date resolution. If no date is found, `VoiceDraft.date` is `null`
and ConfirmCard shows "חסר", disabling the save button (`canSave = false`).

## 5. How day-sheet add still works

Tapping a calendar cell calls `setSelectedDay(ds); setSheetOpen(true)`.
DayDetailSheet still has its own footer with a mic button and "הוספה ידנית".
Both call the same `handleVoiceRecord()` and `setShowManual(true)` handlers.
ManualModal `defaultDate` is `selectedDay`, which equals the tapped day.

## 6. How ConfirmCard is shared

Both paths (main screen and day sheet) wire into the same `VoiceAddFlow`
component mounted at root level. `VoiceAddFlow` uses `ConfirmCard` for all
confirm/correcting states. Neither path bypasses it.

## 7. How missing date/time are handled

`VoiceAddFlow` computes:
```ts
const canSave = Boolean(trimTitle && date && time)
```
When `date` or `time` is null, `canSave = false`. ConfirmCard shows "חסר" and
the save button is disabled. The user must tap "לא, לתקן" to fill in the field.

## 8. Family relationship resolution from main voice

`processVoiceTranscript` extracts a `personPhrase` from speech.
`resolveDraftPerson` calls `resolvePersonPhrase(phrase)`:
- "הבעל של אופיר" / "בעלה של אופיר" → status=resolved, name=גלעד
- Ambiguous → status=ambiguous, candidates shown as chips in ConfirmCard
- Missing → status=missing, calm "לא מצאתי בוודאות מי" message

The resolved name replaces the phrase in the title before display and save.

## 9. Tests added

`calendarAddSurface.test.tsx` — 36 tests across 6 describe blocks:
- Root-level DEV marker (4)
- Main-screen primary ADD bar (9): testids, position:fixed, no selectedDay,
  no diagnostics, hidden on sheet open, appears after DayDetailSheet in DOM
- DayDetailSheet secondary path (4): open/closed state, mic+manual in footer
- Main-screen voice without selected day (3): missing date, full parse, ConfirmCard
- Family resolution (3): הבעל של אופיר → גלעד, VoiceAddFlow confirm render
- ConfirmCard contract (4): buttons, no VoiceCard, ambiguous, missing
- Structural contracts (7): no VoiceCard, no VoiceTraceCard, createAppointmentSafe,
  manual add wired in both bar and sheet

## 10. Validation results

- `npm run typecheck`: PASS
- `npm test`: 2236 / 2236 PASS (102 files)
- `npm run build`: PASS (24 precache entries, 702.95 KiB)

## 11. Manual QA steps

1. Open AbuCalendar.
2. Verify VOICE_RESET_ACTIVE_614F33D is visible in bottom-left corner.
3. Verify the gold mic button and "＋ הוספה ידנית" are visible WITHOUT tapping any day.
4. Tap the mic button on the main screen.
5. Say: "תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר"
6. Verify: ConfirmCard appears showing "פגישה עם גלעד", "הבעל של אופיר", "21:00", "מחר"
7. Verify: buttons "כן, לשמור" / "לא, לתקן" / "ביטול" are present.
8. Verify: no DEBUG/diagnostic text visible.
9. Tap "כן, לשמור".
10. Verify: saved confirmation shows "פגישה עם גלעד", not the raw sentence.
11. Tap "＋ הוספה ידנית" from main screen.
12. Verify: ManualModal opens with today's date as default.
13. Tap a calendar day.
14. Verify: DayDetailSheet opens with mic and "הוספה ידנית" in its footer.
15. Verify: main-screen bar is no longer visible (covered/hidden by sheet).
16. Tap mic inside the day sheet.
17. Verify: same voice flow starts (no regression).
