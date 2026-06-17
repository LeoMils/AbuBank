# ABUREMINDER REDESIGN MASTERPLAN
## From Calendar Feature to Life-Safety System

**Core Problem:** A reminder that only fires when the app is open isn't a reminder.
It's a note.

Martita may be taking medication. She sets a reminder. Closes the phone.
Nothing happens. She misses her medication.

This is a **healthcare safety failure**, not a UX issue.

---

## CURRENT ARCHITECTURE (What's Wrong)

```
ReminderDueEngine.tsx
  └─ useEffect → setInterval(30s)
      └─ listDueReminders()
          └─ if due → show popup
```

**Fatal flaw:** The `setInterval` lives inside a React component.
When the component unmounts (user navigates away, app closes), the interval dies.
All reminders become invisible.

---

## TARGET ARCHITECTURE

### Layer 1: Reliable Delivery (Service Worker)

```
ServiceWorker (background process, survives app close)
  ├─ pushManager.subscribe() → cloud push token
  ├─ periodicsync('reminder-check') every 15 min
  └─ self.registration.showNotification()
      ├─ title: "💊 כדור לחץ דם"
      ├─ body: "הגיע הזמן לקחת את התרופה"
      ├─ icon: /icon-reminder.png
      ├─ badge: /badge.png
      ├─ vibrate: [200, 100, 200]
      ├─ actions: [
      │     { action: 'done', title: 'לקחתי ✓' },
      │     { action: 'snooze', title: 'עוד 10 דקות' }
      │  ]
      └─ tag: reminder-${id} (deduplication)
```

### Layer 2: In-App Experience (when app is open)

Keep the current popup (it's good!) but make it richer.
Full-screen modal. No distraction. One clear action.

### Layer 3: Persistence (IndexedDB)

All reminders stored in IndexedDB (not just localStorage) so they survive:
- Browser cache clear
- App "close" without explicit delete
- Multiple browser contexts

```typescript
// DB schema
interface ReminderRecord {
  id: string
  title: string
  category: ReminderCategory
  dueAt: string           // ISO datetime
  recurrence?: RecurrenceRule
  status: 'active' | 'done' | 'snoozed' | 'deleted'
  snoozeUntil?: string    // ISO datetime
  doneAt?: string         // ISO datetime
  alertPolicy: AlertPolicy
  createdAt: string
  updatedAt: string
}
```

---

## REMINDER CREATION FLOW (REDESIGNED)

### Entry Point
**Dedicated "תזכורות" screen** — accessible from main navigation (NOT buried in Calendar).
Also: persistent "＋ תזכורת" button on home screen.

### Creation: Two Paths

**Path A: Voice (primary)**
Tap microphone:
```
"תזכירי לי בעוד שעה לקחת כדור לחץ דם"
→ Parsed: medication reminder, +60 min
→ Confirmation: "אזכיר לך בשעה 15:30 לקחת כדור לחץ דם. ✓"
```

**Path B: Manual (equal priority)**
```
┌──────────────────────────────────────┐
│ תזכורת חדשה                          │
│                                      │
│ מה לזכור?  [לקחת כדור         ]      │
│                                      │
│ מתי?                                 │
│ [בעוד 30 דק'] [בעוד שעה] [בחרי]     │
│                                      │
│ חוזרת?  [לא]  [כל יום]  [כל שבוע]   │
│                                      │
│ [      שמרי תזכורת      ]            │
└──────────────────────────────────────┘
```

Time shortcuts: "בעוד 15 דקות", "בעוד 30 דקות", "בעוד שעה", "היום בערב", "מחר בבוקר".
Time picker fallback: clock face (not HH:MM text input).

### Confirmation (voice path)
```
┌──────────────────────────────────────┐
│ הבנתי!                               │
│                                      │
│  💊  לקחת כדור לחץ דם               │
│      היום בשעה 15:30                 │
│      (בעוד שעה)                      │
│                                      │
│  🔔  אשמיע צליל + אודיע על המסך     │
│      (גם כשהאפליקציה סגורה)         │  ← CRITICAL: must be true!
│                                      │
│  [      כן, אני סומכת עלייך      ]   │
│  [ לתקן ]                            │
└──────────────────────────────────────┘
```

The phrase "גם כשהאפליקציה סגורה" is a **promise to Martita**.
If we can't deliver this promise → don't show it.
This requires Service Worker push to be implemented first.

---

## REMINDER CATEGORIES (REDESIGNED)

| Category | Emoji | Color | Voice Triggers | Default Action Label |
|----------|-------|-------|----------------|---------------------|
| medication | 💊 | Sage Green | כדור, תרופה, גלולה, ויטמין | "לקחתי ✓" |
| water | 🥤 | Light Blue | לשתות מים, שתייה | "שתיתי ✓" |
| call | 📞 | Rose Gold | להתקשר, לצלצל, לכתוב ל | "התקשרתי ✓" |
| food | 🥣 | Warm Orange | לאכול, לאפות, לכבות תנור, סיר | "עשיתי ✓" |
| exercise | 🚶‍♀️ | Teal | הליכה, התעמלות, פיזיותרפיה | "עשיתי ✓" |
| birthday | 🎂 | Gold | יום הולדת (auto from family_data) | "שלחתי ✓" |
| appointment-prep | 📋 | Teal | מסמכים, להתארגן, ביטוח | "מוכנה ✓" |
| general | 🔔 | Amber | anything else | "בוצע ✓" |

**Manual category override:** User can tap the emoji to change category.

---

## REMINDER BOARD (REDESIGNED)

### Layout
```
┌──────────────────────────────────────┐
│ תזכורות שלי           [+ חדשה]       │
├──────────────────────────────────────┤
│ עכשיו ●                              │
│ ┌────────────────────────────────┐  │
│ │ 💊  לקחת כדור לחץ דם           │  │  ← 80px row
│ │      היה אמור: 09:00            │  │
│ │  [  לקחתי ✓  ]  [ עוד 10 ד' ] │  │  ← 60px buttons
│ └────────────────────────────────┘  │
├──────────────────────────────────────┤
│ היום בהמשך                          │
│  🥤  13:00  לשתות מים              │  ← 64px row
│  📞  17:00  להתקשר למור            │
├──────────────────────────────────────┤
│ עבר הזמן ⚠️                          │
│  💊  08:00  כדור ערב               │  ← Shows overdue reminders
│  [  לקחתי בכל זאת  ]  [  מחקי  ]  │
├──────────────────────────────────────┤
│ חוזרות                              │
│  💊  כל יום 09:00 · כדור בוקר      │
│  💊  כל יום 21:00 · כדור ערב       │
│  📞  כל שישי 17:00 · לצלצל למור   │
└──────────────────────────────────────┘
```

### Row Design (All rows ≥ 64px)
```
┌─────────────────────────────────────┐
│  💊    לקחת כדור לחץ דם             │  ← Emoji (28px) + Title (18px bold)
│        היום בשעה 09:00              │  ← Time label (16px, muted)
│                              [⋯]   │  ← More actions (not direct delete)
└─────────────────────────────────────┘
```

"⋯" menu → "הסנוזי", "דלגי להיום", "שנגי שעה", "מחקי" (each 48px minimum).

### "Due Now" Full-Screen Takeover
When a reminder fires AND the app is open:
```
┌──────────────────────────────────────┐
│ (Backdrop: blurred screen, dark)     │
│                                      │
│              🔔                      │  ← Bell, animated (gentle wave)
│                                      │
│  הגיע הזמן!                          │  ← 32px Heebo Bold
│                                      │
│       💊  לקחת כדור לחץ דם          │  ← Category emoji + title
│                                      │
│       09:00  ·  היום                │  ← Context
│                                      │
│  ┌────────────────────────────────┐ │
│  │         לקחתי ✓                │ │  ← Primary button, full-width, 80px
│  └────────────────────────────────┘ │
│                                      │
│  [ עוד 10 דקות ]   [ הסרי תזכורת ] │  ← Secondary, 56px
└──────────────────────────────────────┘
```

**Sound:** Gentle melodic bell, 3 repeats, 2s intervals.
**Haptics:** Soft rhythmic vibration pattern.
Respects device mute (no sound if phone is muted, but screen still appears).

---

## RECURRING REMINDER ENGINE

### Frequency Options
- Every N minutes (for relative-time, short duration)
- Daily at HH:MM
- Weekly on specific days at HH:MM
- Annually on MM-DD (birthdays, anniversaries)

### Recurrence Rule Schema
```typescript
interface RecurrenceRule {
  frequency: 'once' | 'minutes' | 'daily' | 'weekly' | 'yearly'
  intervalMinutes?: number     // for 'minutes' frequency
  daysOfWeek?: number[]        // 0=Sunday for 'weekly'
  timeOfDay?: string           // "HH:MM" for daily/weekly
  monthDay?: string            // "MM-DD" for yearly
  endDate?: string             // null = forever
  skipDates?: string[]         // ISO dates to skip ("skip today")
}
```

### "Skip Today" Feature (NEW)
On a recurring reminder that fired: show "דלגי להיום" button.
This adds today's date to skipDates without affecting future occurrences.

---

## REMINDER DISPLAY IN CALENDAR (REDUCED ROLE)

After the redesign, Calendar shows reminders only if they're time-relevant to a specific appointment:
- "💊 10 דקות לפני רופא: תארגני מסמכים"

Calendar does NOT show the full reminder board.
Reminder board lives on its own screen.

---

## MIGRATION PATH (Current → New)

### Phase 1 (Priority): Fix the safety issue
- Implement Service Worker push notifications
- Move reminder storage from localStorage to IndexedDB
- Test: set reminder → close tab → notification fires

### Phase 2: Dedicated screen
- Add "תזכורות" to main navigation
- Move ReminderBoard out of Calendar
- Add manual creation form

### Phase 3: Enrich
- Category override UI
- "Skip today" for recurring
- Birthday/anniversary annual type
- Snooze with time picker

### Phase 4: Polish
- Sound design for reminder alerts
- Haptic patterns
- In-app animation for due popup

---

## SUCCESS METRICS

| Metric | Current | Target |
|--------|---------|--------|
| Reminder fires when app closed | 0% | 95% |
| Reminder creation time (voice) | ~30s | < 10s |
| Reminder creation time (manual) | Not possible | < 20s |
| Touch target compliance | 60% | 100% |
| User discovers reminder feature | Low (buried) | High (dedicated screen) |
