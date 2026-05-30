# CALENDAR REDESIGN MASTERPLAN
## AbuCalendar — Architecture-First Redesign

**Audience:** Martita, 80+, Hebrew, non-technical
**Design Principle:** A schedule app, not a calendar. Events, not dates.
**Core Insight:** Martita doesn't think in "May 31." She thinks in "Sunday, ראשון."

---

## CURRENT STATE PROBLEMS

1. Month grid is the default view — requires mental mapping from date to events
2. Voice entry requires: open calendar → select day → open sheet → tap mic — 4 actions before speaking
3. Appointment editing requires delete + recreate — no edit-in-place
4. Reminders are embedded in Calendar — wrong information architecture
5. Day detail sheet can accidentally close
6. Delete is one tap — catastrophic for seniors
7. 36px action buttons (too small)
8. Time parsing partially broken for common patterns
9. No birthday integration from family data

---

## NEW INFORMATION ARCHITECTURE

```
AbuCalendar
├─ Default View: THIS WEEK (list, chronological)
├─ Alt View: Month Grid (toggle button, top-right)
├─ Upcoming: Next 14 days (always accessible via "הקרוב")
│
├─ Quick Add (always visible floating button)
│   ├─ Voice → VoiceSheet
│   └─ Manual → ManualSheet
│
├─ Appointment Detail (tap any event)
│   ├─ View details
│   ├─ Edit in place
│   ├─ Share to WhatsApp
│   └─ Delete (with confirmation)
│
└─ Birthday/Anniversary layer (auto-populated from family_data.json)
```

---

## VIEWS

### View 1: This Week (NEW DEFAULT)

**Purpose:** Answer "what's happening?" without any tapping.

```
SCREEN LAYOUT:
────────────────────────────────────────
  ◀ אוגוסט  שבוע זה  ▶        [חודש]
────────────────────────────────────────
  שישי, 29 במאי — היום
  ┌────────────────────────────────┐
  │ 🟡  10:00  רופא שיניים         │  ← EventRow (72px tall)
  └────────────────────────────────┘
  ┌────────────────────────────────┐
  │ 👨‍👩‍👧  14:00  ארוחת שישי         │
  └────────────────────────────────┘

  שבת, 30 במאי — מחר
  ┌────────────────────────────────┐
  │  🕊️  שבת — יום מנוחה           │  ← Holiday row (muted, no tap action)
  └────────────────────────────────┘

  ראשון, 31 במאי
  ┌────────────────────────────────┐
  │ 💉  09:00  בדיקת דם             │
  └────────────────────────────────┘
  ┌────────────────────────────────┐
  │ 🧵  14:00  תור לתופרת           │
  └────────────────────────────────┘

  שני, 1 ביוני
  (✨ לא נמצאו אירועים — רוצי להוסיף?)

────────────────────────────────────────
              [🎤 הוסיפי אירוע]
────────────────────────────────────────
```

Navigation: swipe left/right = next/prev week. Header chevrons = same.

### View 2: Month Grid (Alt View)

Retain current month grid but with improvements:
- Day numbers: 20px (currently 15px)
- Day headers: Full abbreviated Hebrew ("אח׳", "שנ׳", "שלי׳", "רב׳", "חמ׳", "שש׳", "שבת")
- Today cell: Filled amber background (not just border)
- Event dots: Larger (8px), colored by type
- Tap a day: Expands to show events inline (no bottom sheet — eliminates accidental close)
- Long-press a day: Quick add for that day

### View 3: Upcoming (NEW)

A simple flat list: All events from today forward, max 30 events.
Accessible from calendar header "הקרוב" button.
```
  היום, שישי 29 במאי
    🟡 10:00  רופא שיניים
    👨‍👩‍👧 14:00  ארוחת שישי

  ראשון 31 במאי
    💉 09:00  בדיקת דם

  שני 1 ביוני
    🎂 יום הולדת — עילי  (from family_data)

  שלישי 2 ביוני
    —
```

---

## EVENT TYPES & VISUAL SYSTEM

Each event has a TYPE that determines:
- Emoji (auto-assigned, user can change)
- Left-stripe color
- Section it appears in

| Type | Emoji | Stripe Color | Auto-detect Keywords |
|------|-------|-------------|---------------------|
| medical | 🏥 | Teal #0FAAA0 | רופא, תור, בדיקה, דנטיסט, קרדיולוג |
| family | 👨‍👩‍👧 | Rose Gold #C08080 | ילדים, מור, אופיר, עילי, לאו, משפחה, ארוחה |
| birthday | 🎂 | Amber #D4A853 | יום הולדת, עב׳ (auto from family_data) |
| reminder-prep | 💊 | Sage #7EA98F | תרופה, כדור, רפואי |
| personal | ⭐ | Light Gold | default for everything else |
| holiday | 🕊️ | Muted White | from Hebrew calendar API |

---

## VOICE CREATION FLOW (REDESIGNED)

### Trigger
- Persistent floating button: always visible, always tappable
- Position: bottom-right (not inside a sheet that can close)
- Size: 72×72px
- Always labeled: "🎤 הוסיפי"

### States: 3 only (was 9)

**STATE 1: LISTENING**
```
Modal slides up (80% screen height):
────────────────────────────────────
  [  ×  ]

        🎤

  אני מקשיבה לך...

  ┌──────────────────────────────┐
  │ לדוגמה:                      │
  │ "תור לרופא מחר בעשר בבוקר" │
  └──────────────────────────────┘

  ─────────────────── ████░░ 4 שניות
  (silence detector countdown — resets when speaking)

  [      ⏹ סיימתי דברתי      ]      (72px)
────────────────────────────────────
```
Auto-stops on 4 seconds silence.
No "processing" state visible — transition is seamless.

**STATE 2: CONFIRMATION**
```
────────────────────────────────────
  הנה מה שהבנתי:

  ┌──────────────────────────────┐
  │  📅  מחר, שבת 30 במאי        │
  │  🕐  10:00 בבוקר              │
  │  🏥  תור לרופא שיניים         │
  │                              │
  │  [🎤 לא נכון — אגיד שוב]     │  ← Re-record, not manual edit
  └──────────────────────────────┘

  [       ✓ כן, לשמור       ]    (72px, full-width, amber)
  [ ✏️ לתקן ידנית ]               (48px, ghost)
────────────────────────────────────
```

**STATE 3: SUCCESS**
```
────────────────────────────────────
       ✓

  נשמר!

  תור לרופא שיניים
  מחר בשעה 10:00 בבוקר

  [  הצגי ביומן  ]
────────────────────────────────────
(Auto-closes after 3 seconds)
```

### Disambiguation (AM/PM)
```
────────────────────────────────────
  שאלה אחת:

  אמרת "שלוש" — כוונתך:

  ┌──────────────────┐  ┌──────────────────┐
  │       3:00        │  │       15:00       │
  │  שלוש בלילה       │  │  שלוש אחר הצהריים │
  └──────────────────┘  └──────────────────┘
────────────────────────────────────
```
Both buttons are 50% width, equal visual weight.

### Missing Field Recovery
Not an error. A friendly question.
```
  הבנתי שרוצי להוסיף תור לרופא,
  אבל לא שמעתי מתי. מתי זה?

  [  היום  ]  [  מחר  ]  [  בחרי תאריך  ]
```

---

## APPOINTMENT DETAIL (REDESIGNED)

### View Mode
Tapping an event opens a detail card (not a bottom sheet — an inline expansion).
```
┌────────────────────────────────────┐
│  🏥  תור לרופא שיניים              │
│                                    │
│  📅  מחר, שבת 30 במאי             │
│  🕐  10:00 בבוקר                   │
│  📍  מרפאת רמב"ם, כפר סבא          │
│                                    │
│  [  ✏️ ערכי  ]  [  📱 שתפי  ]  [  🗑 מחקי  ]
└────────────────────────────────────┘
```
All three actions visible. Delete opens confirmation dialog:
"האם למחוק את התור לרופא שיניים מחר? פעולה זו לא ניתנת לביטול."
[  כן, מחקי  ]  [  ביטול  ]

### Edit Mode (INLINE)
```
┌────────────────────────────────────┐
│  📝 עריכה:                         │
│                                    │
│  כותרת:  [תור לרופא שיניים    ]   │
│  תאריך:  [שבת 30 במאי         ]   │
│  שעה:    [10:00               ]   │
│  מיקום:  [מרפאת רמב"ם         ]   │
│  הערות:  [                    ]   │
│                                    │
│  [  שמרי שינויים  ]  [  ביטול  ]  │
└────────────────────────────────────┘
```
Date field: Opens a natural date picker (day grid with Hebrew names).
Time field: Clock-face picker (analog, not digital).

---

## MANUAL ENTRY (REDESIGNED)

Current flow: "הוספה ידנית" → modal → confirmation
New flow: "✏️ הוסיפי ידנית" → smart form → one-tap save

The form is simple: 3 required fields (title, date, time), 1 optional (notes).
Date: Shows week view to tap a day (not YYYY-MM-DD input).
Time: Analog clock (hour first, then minute).

No confirmation card needed for manual entry — trust the user.
Save immediately. Show undo toast (6 seconds).

---

## BIRTHDAY INTEGRATION

Automatically populate from `knowledge/family_data.json`:

```typescript
// Each birthday becomes a repeating annual event
{
  title: "🎂 יום הולדת — ${name}",
  type: 'birthday',
  date: MM-DD (current year or next year if passed),
  time: null (all-day event),
  notes: "${name} הולד/ת בשנת ${birthYear}",
  recurring: { frequency: 'yearly' }
}
```

Show reminder 7 days before, 1 day before, on the day.

---

## ARCHITECTURE SUMMARY

| Component | Current | Redesigned |
|-----------|---------|-----------|
| Default view | Month grid | This Week list |
| Voice trigger | Inside DayDetailSheet | Floating, always visible |
| Voice states | 9 | 3 |
| Event editing | Delete + recreate | Edit in place |
| Delete safety | 4s undo toast | Confirmation dialog |
| Touch targets | Mix of 36-60px | 60px minimum |
| Birthday events | None | Auto from family_data |
| Month navigation | Buttons only | Swipe + buttons |
| Day click area | Opens bottom sheet | Inline expansion |
| Time picker | Digital HH:MM | Analog clock |
| Date picker | YYYY-MM-DD | Tap-a-day grid |
