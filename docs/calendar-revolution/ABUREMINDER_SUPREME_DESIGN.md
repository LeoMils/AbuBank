# AbuReminder Supreme Design Contract

## 1. Product Vision

**"מרטיטה אומרת, אבו זוכר."**

Martita presses one mic. She speaks naturally. AbuBank understands, repeats back
in voice+screen, shows a confirm card, and saves only after she approves.
At the right time: sound + popup. One tap to confirm, snooze, or dismiss.

AbuReminder is not a medication scheduler. It is not a caregiver dashboard.
It is: *"תגידי לי, ואני אזכור בשבילך."*

## 2. MVP Scope

**In scope:**
- One-time reminders (explicit time: today/tomorrow/day-of-week)
- Relative-time reminders ("בעוד שעתיים")
- Recurring daily reminders ("כל יום בתשע")
- Voice input via shared main mic
- Parsed readback on screen (spoken if TTS available)
- Confirmation card before save (no silent save)
- In-app due popup (while app is open)
- Done / snooze (10 min) / delete actions
- Overdue section (never silently deleted)
- Reminder memory board (today / upcoming / overdue / recurring)
- Family name resolution (reuses existing resolver — no new data)
- Integration with main AbuCalendar mic (intent routing)

**Deferred (not in this sprint):**
- Manual reminder add UI
- Voice yes/no approval (requires second recording session)
- Background notifications (PWA limitation — not guaranteed)
- Caregiver dashboards
- Cloud sync
- Native app wrapper
- Full medication compliance tracking
- Multi-intent utterances in a single sentence
- Recurring weekly on specific days (partial — needs more testing)

## 3. UX Principles

1. **Voice-first, buttons as fallback.** Every action must be completable by button.
2. **No silent save.** Every reminder goes through ConfirmCard before persisting.
3. **No hidden debug.** Zero raw transcript, internal JSON, or technical metadata.
4. **Large touch targets.** Minimum 56px. Primary actions 60px.
5. **No scary wording.** Never clinical, never error-heavy.
6. **Emotional reassurance.** "אני אזכור בשבילך" — warm, not robotic.
7. **Hebrew/RTL native.** All copy in Hebrew. RTL layout throughout.
8. **360×740 safe.** All UI fits without horizontal scroll on small phones.
9. **No overload.** Maximum 3 sections visible in board; truncate gracefully.

## 4. Reminder State Machine

```
idle
 ├─ recording        (mic active)
 ├─ processing       (Whisper + parser running)
 ├─ confirming       (ConfirmCard shown, waiting for tap)
 │   ├─ asking_clarification  (ambiguous time or person)
 │   └─ correcting            (user tapped "לא, לתקן")
 ├─ saved            (confirmed, persisted, readback shown)
 ├─ due              (ReminderDueEngine popup visible)
 ├─ snoozed          (dismissed + 10 min timer set)
 ├─ done             (confirmed by user)
 ├─ overdue          (due time passed without action)
 ├─ cancelled        (user cancelled before save)
 └─ error            (parse/save failure, honest message shown)
```

## 5. Voice Confirmation Contract

1. After parse: generate `readbackText` from normalized draft (NEVER from raw
   transcript).
2. Attempt `speechSynthesis.speak(readbackText)` — if unavailable, display
   the text prominently on screen and log "TTS unavailable" (no crash).
3. Show ConfirmCard simultaneously — buttons are always present.
4. Voice yes/no approval NOT implemented in MVP (requires second recording
   session). Future sprint.
5. "כן, לשמור" tap → save → show "נשמרה" with readback → auto-dismiss 4s.
6. "לא, לתקן" tap → correction fields appear.
7. "ביטול" tap → draft discarded, state returns to idle.

## 6. Reminder Data Model

```typescript
type ReminderCategory = 'medication' | 'call' | 'home' | 'appointment_prep' | 'water' | 'general'
type ReminderStatus   = 'scheduled' | 'due' | 'snoozed' | 'done' | 'overdue' | 'cancelled'

type Reminder = {
  id: string
  kind: 'reminder'
  category: ReminderCategory
  title: string
  originalText?: string          // internal; never displayed by default
  dueAt: string                  // ISO datetime "2026-05-29T10:00:00"
  displayDateLabel: string       // "מחר" / "היום" / "ב-30 במאי"
  displayTimeLabel: string       // "10:00" / "בעוד שעה"
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'custom'
    daysOfWeek?: number[]        // 0=Sunday
    time: string                 // "HH:MM"
  }
  alertPolicy: {
    sound: boolean
    voice: boolean
    repeatUntilConfirmed: boolean
    snoozeMinutes: number
    remindBeforeMinutes?: number
    maxRepeats?: number
  }
  status: ReminderStatus
  snoozedUntil?: string
  confirmedAt?: string
  createdAt: string
  updatedAt: string
}
```

**Storage:** `localStorage` key `abu_reminders_v1`. Array of `Reminder` objects.
No mixing with appointment schema. Versioned key prevents silent corruption.

**Never stored:** phone numbers, medical notes, private metadata.

## 7. Parser Contract

Input: raw Hebrew transcript + today's ISO date.

Output: `ReminderDraft` — always returned, never throws.

Required output fields:
- `intent: 'reminder'`
- `title` (or undefined if not parseable)
- `category`
- `dueAt` (ISO) or `missingFields` includes 'time'/'date'
- `displayDateLabel` / `displayTimeLabel`
- `readbackText` — generated from normalized fields, never from raw transcript
- `missingFields[]` — what the user must provide before saving
- `ambiguity?` — only when genuine ambiguity detected
- `familyResolution?` — only when a person phrase is present

**Never in parser output:** raw transcript, private family metadata, phone
numbers, medical notes.

## 8. Ambiguity Contract

| Situation | UI Response |
|-----------|-------------|
| Time is genuinely ambiguous (e.g., "בשתיים" alone) | Show [2 בבוקר] [2 אחה"צ] chips |
| Person is ambiguous (הבן של מור → multiple candidates) | Show candidate chips |
| Date missing | Show [בעוד שעה] [היום בערב] [מחר בבוקר] [לבחור שעה] |
| Title missing | Show correction field |
| Route ambiguous (reminder vs appointment) | Show [לשמור תזכורת] [לקבוע פגישה] |

Save button is **disabled** until all ambiguities are resolved.

## 9. Due Reminder Contract

**While app is open (guaranteed):**
- Check every 30 seconds.
- Find reminders where `status === 'scheduled'` AND `dueAt <= now`.
- Show in-app popup.
- Play sound if `alertPolicy.sound === true` and browser allows.
- Speak via TTS if `alertPolicy.voice === true` and TTS available.
- Actions: לקחתי (done), עוד 10 דקות (snooze), מחיקה (cancel).

**When app is closed (NOT guaranteed):**
- No background notification support in this PWA implementation.
- User-facing disclosure: "תזכורת תופיע כשהאפליקציה פתוחה."

## 10. Overdue Contract

- Reminders not acknowledged become `overdue` after `dueAt + 2 hours`.
- Overdue reminders appear in "עבר זמנו" section of the board.
- Never silently deleted.
- Actions: בוצע (mark done), להזכיר שוב (reschedule +1 hour), מחיקה.

## 11. Sound / Voice Contract

**Sound:**
- Use `new Audio(...)` with a safe beep dataURI or existing `soundAlert()`.
- If autoplay blocked, silently continue (popup still shows).
- If AudioContext suspended, silently continue.

**Voice readback (TTS):**
- Use `window.speechSynthesis.speak(utterance)` if API exists.
- Hebrew language hint: `lang = 'he-IL'`.
- If unavailable: show `readbackText` on screen, mark voice unavailable.
- Never crash on TTS failure.

## 12. PWA / Browser Notification Limitations

| Capability | Status |
|------------|--------|
| In-app due popup (app open) | SUPPORTED |
| In-app sound (app open) | SUPPORTED (may need user gesture) |
| In-app TTS (app open) | SUPPORTED if browser supports speechSynthesis |
| Background notifications | NOT SUPPORTED without Service Worker push + server |
| Persistent reminders across browser restarts | Supported via localStorage |
| Reminders when app tab is closed | NOT SUPPORTED |

**User-facing disclosure required** in ConfirmCard: "תזכורת תופיע כשהאפליקציה פתוחה."

## 13. Privacy / Safety Boundaries

- `originalText` (raw transcript) stored internally but never rendered in UI.
- Family resolution: names only, no relationship metadata, no phone numbers.
- Medical reminders: category tagged as `medication` only. No drug details stored.
- No caregiver visibility. No cloud sync. No server transmission.
- No storage of location, health status, or financial information.
- `alertPolicy` is purely notification behavior — no inferred health data.

## 14. Test Strategy

**Parser tests (40+ cases):** Relative time, absolute time, recurring, ambiguity,
category detection, command verb stripping, family resolution, missing fields,
readback generation.

**Store tests:** CRUD, localStorage round-trip, status transitions, list queries,
snooze/done/cancel, migration-safe key.

**ConfirmCard tests:** Render, buttons, no debug output, ambiguous/missing states,
family secondary line.

**Due engine tests:** Due detection, snooze, done, delete, multiple due, overdue
transition.

**Appointment regression:** Existing appointment creation flow must continue to
pass all 36 calendarAddSurface tests and full 2251 test suite.

## 15. Rollout Plan

1. **Sprint 1 (this):** Core module, parser, store, ConfirmCard, due engine,
   board, main mic routing. Local commit. No push until APPROVE PUSH.
2. **Sprint 2:** Voice yes/no approval, manual reminder add UI, recurring weekly.
3. **Sprint 3:** UI polish, sound refinement, board animations.
4. **Sprint 4:** PWA push notification investigation (service worker complexity).

## 16. Manual QA Plan

1. Open AbuCalendar. Verify mic bar visible without day tap.
2. Tap mic. Say "תזכירי לי לקחת כדור מחר בעשר בבוקר".
3. ConfirmCard appears: "אני אזכור בשבילך" heading, "לקחת כדור", "מחר · 10:00".
4. No debug text visible anywhere.
5. Tap "כן, לשמור". Reminder board shows new reminder under "היום בהמשך" or "מחר".
6. Tap mic. Say "תזכירי לי בעוד חצי שעה לשתות מים".
7. ConfirmCard shows relative time: "בעוד חצי שעה".
8. Tap mic. Say "תזכירי לי כל יום בתשע בבוקר לקחת תרופה".
9. ConfirmCard shows recurring: "כל יום · 09:00".
10. Wait for/simulate due time → popup appears.
11. Tap "עוד 10 דקות" → popup disappears, reappears 10 minutes later.
12. Tap "לקחתי" → moved to done.
13. Existing appointment flow still works (regression check).

## 17. Follow-Up Roadmap

| Item | Priority |
|------|----------|
| Voice yes/no approval | High |
| Manual reminder add UI | High |
| Recurring weekly on specific day | Medium |
| Background notification (SW push) | Medium |
| Medication recurring + daily summary | Medium |
| Reminder statistics / history | Low |
| Caregiver shared view | Deferred (privacy review required) |
| Internationalization (Spanish) | Low |

## 18. Red Team Findings

See ABUREMINDER_SUPREME_REPORT.md Section 20.
