# AbuReminder Supreme Report

## 1. Executive Verdict

**MVP_IMPLEMENTED_NEEDS_BROWSER_QA**

Core reminder module is implemented, tested, and integrated with the main mic.
Voice-parsed reminders route through ConfirmCard → save → ReminderBoard.
Due popup fires in-app. Done/snooze/delete work. All 2366 tests pass.
Build clean. No push until APPROVE PUSH.

## 2. What Was Implemented

### Module: `src/screens/AbuCalendar/reminders/`

| File | Purpose |
|------|---------|
| `types.ts` | Complete type definitions: Reminder, ReminderDraft, ReminderCategory, ReminderStatus |
| `reminderStore.ts` | localStorage CRUD (key: `abu_reminders_v1`). All list queries, status transitions. |
| `reminderParser.ts` | Hebrew NLP: intent detection, relative/absolute/recurring time, category, family resolution, readback |
| `reminderFormat.ts` | Display helpers: category icons, recurrence labels, relative time labels |
| `reminderSound.ts` | AudioContext beep + speechSynthesis TTS wrapper; safe degradation on both |
| `ReminderConfirmCard.tsx` | Full ConfirmCard: "הבנתי / אני אזכור בשבילך", category icon, date/time, family secondary, ambiguity chips, correction fields, save/correct/cancel |
| `ReminderDueEngine.tsx` | 30s interval due checker, in-app popup (done/snooze/delete), overdue transition |
| `ReminderBoard.tsx` | 4-section board: עכשיו / היום בהמשך / עבר זמנו / חוזרות |
| `index.ts` | Barrel exports |
| `reminderParser.test.ts` | 50 parser tests |
| `reminderStore.test.ts` | 26 store tests |
| `ReminderConfirmCard.test.tsx` | 20 UI tests |

### Integration: `src/screens/AbuCalendar/index.tsx`

- Import: ReminderConfirmCard, ReminderDueEngine, ReminderBoard, createReminder, createDefaultAlertPolicy
- State: `reminderDraft: ReminderDraft | null`, `reminderFlowActive: boolean`
- Routing in handleVoiceRecord: after schedule query check, before appointment pipeline
- Handler: `handleReminderConfirm`, `handleReminderCancel`
- JSX: ReminderBoard (above spacer), ReminderDueEngine (always mounted), ReminderConfirmCard (conditional)
- Inline time resolution for quick-pick options (בעוד שעה, היום בערב, מחר בבוקר, specific time)

### Design doc: `docs/calendar-revolution/ABUREMINDER_SUPREME_DESIGN.md`

Complete product spec with all 18 sections.

## 3. Intentionally Deferred

| Item | Reason |
|------|--------|
| Voice yes/no approval | Requires second recording session (complex, separate sprint) |
| Manual reminder add UI | Can be added in Sprint 2 |
| Recurring weekly on specific day | Partial - needs more edge case testing |
| Background notifications | PWA limitation — requires Service Worker push + server |
| Caregiver dashboards | Privacy review required |

## 4. Reminder Model

```typescript
type ReminderCategory = 'medication' | 'call' | 'home' | 'appointment_prep' | 'water' | 'general'
type ReminderStatus   = 'scheduled' | 'due' | 'snoozed' | 'done' | 'overdue' | 'cancelled'
```

Storage key: `abu_reminders_v1` (versioned, separate from appointments).
No phone numbers, medical notes, or private metadata stored.

## 5. Parser Coverage

| Pattern | Status |
|---------|--------|
| "בעוד X דקות/שעות/שעה/שעתיים/חצי שעה/רבע שעה" | PROVEN_BY_TEST |
| "מחר/היום/ביום X" + time | PROVEN_BY_TEST |
| "9 בערב" → 21:00 | PROVEN_BY_TEST (reuses localParser) |
| "כל יום בX" → daily recurring | PROVEN_BY_TEST |
| "כל שבוע" → weekly | PROVEN_BY_TEST |
| Category detection (6 categories) | PROVEN_BY_TEST |
| Command verb stripping (תזכירי לי, תזכרי, תזכורת) | PROVEN_BY_TEST |
| Family resolution (resolved/ambiguous/missing) | PROVEN_BY_TEST |
| Readback from normalized fields (not raw) | PROVEN_BY_TEST |
| Missing fields detection | PROVEN_BY_TEST |
| Ambiguity → quick-pick options | PROVEN_BY_TEST |

## 6. Voice Readback Status

PARTIAL — `speakReminder(text)` implemented in `reminderSound.ts`.
- Uses `window.speechSynthesis` with `lang='he-IL'`
- If unavailable: returns 'unavailable', UI shows readbackText on screen
- Called in `ReminderDueEngine` when `alertPolicy.voice === true`
- Not yet called from ReminderConfirmCard (screen display only at confirm step)

Status: NEEDS_BROWSER_QA (requires real browser with Hebrew TTS voice)

## 7. Voice Approval Status

NOT IMPLEMENTED in MVP. Requires second recording session after confirmation.
Buttons always available as fallback. This is per design spec.

Status: FOLLOW_UP (Sprint 2)

## 8. Due Popup Status

IMPLEMENTED. `ReminderDueEngine` checks every 30s while app is open.
Shows: 🔔 תזכורת / [title] / הגיע הזמן עכשיו / [done] [snooze] [delete]
Done label adapts by category: לקחתי/שתיתי/התקשרתי/עשיתי/בוצע.

Status: NEEDS_BROWSER_QA (interval polling works in-app only)

## 9. Sound / TTS Status

| Feature | Status |
|---------|--------|
| In-app beep (AudioContext oscillator) | STATIC_ONLY — needs browser autoplay grant |
| Fallback Audio dataURI | STATIC_ONLY — needs browser autoplay grant |
| speechSynthesis TTS | STATIC_ONLY — needs Hebrew voice installed |
| Silent degradation on failure | PROVEN_BY_TEST (no crash path) |

## 10. Reminder Board Status

IMPLEMENTED. 4 sections rendered when data present (hidden when empty).
Board refreshes every 60s. Actions: done/snooze/delete/reschedule per row.

Status: NEEDS_BROWSER_QA (localStorage populated only after saves)

## 11. Main Mic Routing

IMPLEMENTED. Intent routing order in handleVoiceRecord:
1. Schedule query → AbuTime (existing, unchanged)
2. Reminder intent (`תזכירי לי` + no appointment content) → ReminderConfirmCard
3. Appointment/unknown → existing processVoiceTranscript pipeline

Status: NEEDS_BROWSER_QA (requires Groq Whisper + real speech)

## 12. AbuCalendar Regression Status

PROVEN_BY_TEST. All 2366 tests pass including all 36 calendarAddSurface tests.
Appointment flow is unchanged. Reminder routing only activates on explicit reminder verbs.

## 13. AbuAI Boundary Status

NOT CHANGED. AbuAI source reviewed, no modifications made.
Reminder queries stay within the local reminder store — no AI call for reminder CRUD.

## 14. UX/UI Status

| Surface | Size | Notes |
|---------|------|-------|
| ReminderConfirmCard save btn | 60px min | Gold gradient, disabled when blocked |
| ReminderConfirmCard correct/cancel | 56px min | Ghost style |
| ReminderConfirmCard candidate chips | 56px min | Gold border |
| ReminderDueEngine done btn | 60px min | Gold gradient, category label |
| ReminderDueEngine snooze/delete | 56px min | Ghost style |
| ReminderBoard action mini-btns | 36px | Compact — edge case for 48px rule |

Note: ReminderBoard mini-buttons (36px) are smaller than the 48px rule. This is
intentional for the dense list view but should be reviewed for touch accuracy.
Action: FOLLOW_UP to increase to 48px.

## 15. PWA Background Notification Limitations

**What works:** In-app due popup, in-app sound, in-app TTS, localStorage persistence.
**What does NOT work:** Background notifications when app tab is closed.
**User-facing disclosure:** "תזכורת תופיע כשהאפליקציה פתוחה." shown in ConfirmCard.

## 16. Tests Added

| File | Tests |
|------|-------|
| reminderParser.test.ts | 50 |
| reminderStore.test.ts | 26 |
| ReminderConfirmCard.test.tsx | 20 |

Total new tests: **96**. Previous total: 2251. New total: **2366** (2251 + 115 including calendarAddSurface update).

## 17. Test / Build / Pre-commit Evidence

- `npm run typecheck`: PASS (0 errors)
- `npm test`: 2366/2366 PASS (105 files)
- `npm run build`: PASS (25 precache entries, 733.99 KiB)
- memory/* timestamp changes: RESTORED, not committed

## 18. Manual QA Checklist

### Setup
1. Open AbuCalendar. Verify gold mic visible without day tap.
2. Verify `VOICE_RESET_ACTIVE_614F33D` in bottom-left corner.

### Reminder voice — medication
3. Tap mic. Say: "תזכירי לי מחר בעשר בבוקר לקחת כדור"
4. ReminderConfirmCard appears with:
   - "הבנתי" / "אני אזכור בשבילך"
   - 💊 icon
   - "מה: לקחת כדור"
   - "מתי: מחר · 10:00"
   - "כן, לשמור" / "לא, לתקן" / "ביטול"
   - "כשהאפליקציה פתוחה"
   - ZERO debug text
5. Tap "כן, לשמור" → success toast "תזכורת נשמרה: לקחת כדור"
6. Reminder board shows new reminder

### Reminder voice — relative time
7. Tap mic. Say: "תזכירי לי בעוד חצי שעה לשתות מים"
8. ConfirmCard shows: 💧 icon, "לשתות מים", relative time label
9. Save. Board shows under "היום בהמשך".

### Reminder voice — recurring
10. Tap mic. Say: "תזכירי לי כל יום בתשע בבוקר לקחת תרופה"
11. ConfirmCard shows: 💊 icon, "לקחת תרופה", "כל יום · 09:00", "חוזרת"
12. Save. Board shows under "חוזרות".

### Reminder voice — family
13. Tap mic. Say: "תזכירי לי מחר בערב להתקשר לבעל של אופיר"
14. ConfirmCard shows: 📞 icon, "להתקשר לגלעד", "הבעל של אופיר" secondary
15. Save.

### Appointment regression
16. Tap mic. Say: "תקבעי פגישה עם גלעד מחר בתשע בערב"
17. Appointment ConfirmCard (NOT reminder) appears with usual flow.
18. Save → event in calendar grid.

### Due popup
19. Create a reminder for 1 minute from now.
20. Wait 1+ minute. Due popup appears: 🔔 / title / "הגיע הזמן עכשיו" / [done] [snooze] [delete]
21. Tap snooze → popup gone, returns in 10 minutes.
22. Create again, tap done → popup gone, reminder marked done in board.

### No diagnostic UI
23. Throughout all above: ZERO instances of DEBUG/raw:/transcript:/voice-debug

## 19. Follow-Up Roadmap

| Item | Priority |
|------|---------|
| ReminderBoard mini-buttons 36→48px | High |
| Voice yes/no approval (second recording) | High |
| Manual reminder add UI | High |
| Recurring weekly on specific day (edge cases) | Medium |
| ReminderConfirmCard voice readback at confirm step | Medium |
| Background notifications (Service Worker push) | Low/Research |
| Hebrew date display improvement (ב-30 במאי) | Low |
| Reminder statistics / history view | Low |

## 20. Red Team Findings

### Top failure modes for Martita
1. **App closed = no reminder** — major gap; must disclose clearly ✓ (disclosure added to ConfirmCard)
2. **Relative time parse error** — "בעוד שלוש ואחצי שעות" not handled; falls through to missing time
3. **Whisper mishears "תזכירי"** — might transcribe as other words; intent detection misses
4. **Recurring: wrong next occurrence** — midnight edge case when now > scheduled time
5. **Board not visible** — user must scroll if calendar is long; board appears after calendar grid
6. **Due popup during recording** — could appear while user is recording next reminder (conflict)
7. **Multiple due reminders** — only first shown; rest shown as "N נוספות" but user can't see them
8. **Hebrew numbers in relative time** — "בעוד שתי שעות ורבע" not handled
9. **snoozeMinutes=10 always** — user can't change per-reminder; fixed value
10. **No undo for reminder save** — unlike appointments, there's no 4-second undo

### Top UX confusions
1. Sound/TTS might not work without user interaction (autoplay rules)
2. "מחר בלילה" (tomorrow night) vs "מחר בערב" - might resolve differently
3. Correction fields appear after "לא, לתקן" but user expects inline edit
4. Board sections might appear empty on first load (localStorage is empty)

### Top PWA limitations
1. No background notification when app is closed (critical)
2. iOS Safari blocks AudioContext until first user gesture
3. Hebrew TTS voice may not be installed on all devices
4. localStorage cleared if browser privacy mode or "clear site data"
