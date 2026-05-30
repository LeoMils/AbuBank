# MARTITA VISION 2027
## The Ideal Senior-First AI Companion App

**Design Brief:** What AbuBank becomes when we truly understand Martita.

---

## NORTH STAR

AbuBank 2027 is not an app. It is Martita's daily companion.

She wakes up. The app says good morning. She hears what's happening today.
She speaks. The app understands. Events appear. Reminders fire on time.
Her family is one tap away. Photos arrive. Messages go out.
She never feels confused, rushed, or alone.

Every interaction takes fewer than 3 seconds.
Every screen has one thing to do.
Every error leads to a solution, never a dead end.

---

## DESIGN LANGUAGE

### Color
Not gold. Not tech. **Warm amber light.**

```
Warm Amber (Primary): #D4A853
Deep Night Background: #080604 (slightly warmer than current #0C0A08)
Cream Text: #F5ECD6 (slightly warmer white)
Sky Teal (AI): #0FAAA0
Soft Sage (Reminder): #7EA98F (new — for reminders, calmer than gold)
Rose Gold (Family): #C08080 (new — for family events)
```

No red for errors. Red causes anxiety. Use **deep amber + clear Hebrew message** instead.

### Typography

**One font: Heebo.** Remove Cormorant Garamond from the product entirely.
Serifs are harder for seniors to read. Heebo is clear, warm, and designed for Hebrew.

```
Hero text: Heebo Bold 32px (headline of each screen)
Primary action labels: Heebo SemiBold 22px
Body / event titles: Heebo Regular 18px (NEVER below 18)
Secondary info: Heebo Regular 16px
Fine print: Heebo Regular 15px (ABSOLUTE MINIMUM — never 14px or smaller)

Line height: 1.6 everywhere (generous — never tight)
Letter spacing: 0.01em (slight open tracking for Hebrew readability)
```

### Touch Targets

Every touchable element: minimum **60×60px.**
Primary actions: **72px tall.**
Destructive actions: Always require a separate confirmation tap — never single-tap delete.

### Spacing

Base unit: 8px.
Card padding: 20px.
Section spacing: 32px.
No element closer than 16px to screen edge.

---

## SCREEN-BY-SCREEN VISION

### 1. HOME SCREEN — "הבוקר שלי"

**Vision:** Not a tile grid. A morning briefing.

**Layout (portrait, no scroll):**
```
┌─────────────────────────────────────┐
│  שלום Martita! ☀️ יום שישי בבוקר    │  ← Animated greeting (28px Heebo Bold)
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📅 היום יש לך:              │   │  ← Card: today's first 2 appointments
│  │   10:00 · רופא שיניים       │   │
│  │   14:00 · פגישה עם הילדים   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 💊 תזכורת בעוד 45 דקות      │   │  ← Reminder pill (amber, soft glow)
│  └─────────────────────────────┘   │
│                                     │
│  [🎤 מה קורה?] [📅 יומן] [👨‍👩‍👧 משפחה]   │  ← 3 primary actions (large 72px)
│                                     │
│  ──── שירותים ────                 │
│  [Mizrahi] [Max] [Postal] [More]   │  ← Services (secondary, 56px)
└─────────────────────────────────────┘
```

**Key changes:**
- Today's appointments always visible on home screen
- Active reminder shown as ambient pill
- 3 primary actions: voice, calendar, family
- Services demoted to secondary row

---

### 2. CALENDAR SCREEN — "היומן שלי"

**Vision:** A schedule, not a grid. Martita thinks in events, not dates.

**Default view: THIS WEEK as a list**
```
┌─────────────────────────────────────┐
│ ◀ מאי 2026 ▶         [חודש] [שבוע] │
│                                     │
│ ─── היום, שישי 29 ───              │
│  🟡 10:00  רופא שיניים             │
│  👨‍👩‍👧 14:00  ארוחת שישי           │
│                                     │
│ ─── מחר, שבת 30 ───                │
│  🕊️ שבת — יום מנוחה               │
│                                     │
│ ─── ראשון 31 ───                   │
│  💊 09:00  בדיקת דם                │
│  ─ 14:00  תור לתופרת              │
│                                     │
│              [🎤 הוסיפי]           │  ← Big persistent mic button
└─────────────────────────────────────┘
```

**Month grid available** as alternate view (button toggle top-right).

**Appointment card (list view):**
```
┌─────────────────────────────┐
│ 🟡  10:00                   │  ← Large time (22px)
│    רופא שיניים              │  ← Title (18px bold)
│    מרפאת רמב"ם, כפר סבא    │  ← Location (16px, muted)
│                        [⋯]  │  ← More actions (not delete directly)
└─────────────────────────────┘
```

The × delete button is **gone from the main view.**
Tap the ⋯ menu → options: "ערכי", "שתפי", "מחקי" (with confirmation).

**Empty day:**
```
✨ יום פנוי — מה נוסיפי?
[🎤 הוסיפי בקול]  [✏️ הוסיפי ידנית]
```

---

### 3. VOICE CREATION FLOW — The Experience That Defines The Product

**Vision:** One breath. One action. Done.

Martita presses the mic. She speaks naturally. The app responds with warmth.
Three states, not nine.

**State 1 — LISTENING (Martita speaks)**
```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│          🎤                         │
│                                     │
│     אני מקשיבה לך...               │  ← 28px, warm white
│                                     │
│  ┌──────────────────────────────┐  │
│  │ נסי לומר: "תקבעי לי תור       │  │  ← Rotating example (16px, muted)
│  │ לרופא מחר בעשר בבוקר"        │  │
│  └──────────────────────────────┘  │
│                                     │
│  [    ⏹ סיימתי    ]                 │  ← Large stop button (72px)
│  [ביטול]                            │  ← Secondary cancel
│                                     │
│  ████████░░░░ 4 שניות שקט → עוצרת │  ← Auto-stop countdown bar
└─────────────────────────────────────┘
```
Auto-stop after 4s silence. No need to tap stop.

**State 2 — UNDERSTANDING (brief, < 2 seconds)**
```
[     מעבדת...     ]
```
One line. Warm amber dot animation (not a gear, not tech language).

**State 3 — CONFIRMATION**
```
┌─────────────────────────────────────┐
│  הנה מה שהבנתי:                    │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ 📅 מחר, שבת 30 במאי         │  │
│  │ 🕐 10:00 בבוקר               │  │
│  │ 🏥 תור לרופא שיניים          │  │
│  └──────────────────────────────┘  │
│                                     │
│  [   ✓ כן, לשמור   ]               │  ← Primary, full-width, gold (72px)
│  [   ✏️ לתקן       ]               │  ← Secondary, smaller
│                                     │
└─────────────────────────────────────┘
```
No "ביטול" button. Tapping outside or back button cancels.

**AM/PM Disambiguation:**
```
┌─────────────────────────────────────┐
│  שאלה קטנה:                         │
│                                     │
│  אמרת "שלוש". כוונתך:              │
│                                     │
│  ┌──────────────┐  ┌──────────────┐│
│  │  3:00         │  │  15:00       ││  ← Both show 24h + context
│  │  בלילה        │  │  אחר         ││
│  │               │  │  הצהריים     ││
│  └──────────────┘  └──────────────┘│
└─────────────────────────────────────┘
```

---

### 4. REMINDER SCREEN — "תזכורות שלי"

**Vision:** A gentle presence, not a task list.

Reminders are not a secondary feature of Calendar. They have their own dedicated screen.

**Layout:**
```
┌─────────────────────────────────────┐
│ התזכורות שלי            [+ הוסיפי] │
│                                     │
│ ─── עכשיו ───                       │
│ ┌──────────────────────────────┐   │
│ │ 💊  לקחת כדור לחץ דם         │   │
│ │     היה אמור: 09:00           │   │
│ │  [  לקחתי ✓  ]  [עוד 10 דק'] │   │  ← Big buttons
│ └──────────────────────────────┘   │
│                                     │
│ ─── היום בהמשך ───                  │
│  🥤 13:00  לשתות מים               │
│  📞 17:00  להתקשר למור             │
│                                     │
│ ─── חוזרות ───                      │
│  💊 כל יום 09:00 · כדור              │
│  💊 כל יום 21:00 · כדור ערב          │
└─────────────────────────────────────┘
```

**Reminder creation — dedicated button, always visible:**
Tap "＋ הוסיפי" → voice or manual choice (50/50 split, not voice-first).

**Reminder due popup — full-screen takeover:**
```
┌─────────────────────────────────────┐
│                                     │
│           🔔                        │  ← Large animated bell
│                                     │
│    הגיע הזמן:                       │  ← 28px warm white
│    💊 לקחת כדור                     │  ← 32px BOLD
│                                     │
│    15:00  ·  היום                   │  ← Context
│                                     │
│  [     לקחתי ✓     ]               │  ← Full-width, 72px, sage green
│  [  עוד 10 דקות   ]  [ מחקי ]     │  ← Secondary actions
│                                     │
└─────────────────────────────────────┘
```

---

### 5. FAMILY SCREEN — "המשפחה שלי"

**Vision:** Family is Martita's universe. Give it its own home.

```
┌─────────────────────────────────────┐
│ המשפחה שלי                          │
│                                     │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ │ [Mor]│ │[Ofir]│ │[Eli] │ │[Lau] ││  ← Round photos, name below
│ │  מור │ │ אופיר│ │ עילי │ │ לאו  ││  ← 72px circle
│ └──────┘ └──────┘ └──────┘ └──────┘│
│                                     │
│ ─── יום הולדת קרוב ───              │
│ 🎂 אנבל — עוד 12 יום (3 ביוני)    │
│                                     │
│ ─── אלבום ───                       │
│ [📸 תמונות אחרונות ▶]               │
│                                     │
│ [📱 שלחי הודעה ב-WhatsApp]          │
└─────────────────────────────────────┘
```

Tap any family member → their profile: phone, birthday, recent photos, WhatsApp quick-send.

---

### 6. AbuAI SCREEN — "עוזרת חכמה"

Rename: Not "AbuAI." Call it **"עוזרת חכמה"** or simply by a warm name: **"אבו"**.

```
┌─────────────────────────────────────┐
│ שלום Martita!  💚                    │
│                                     │
│  "שאלי אותי כל דבר"                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ אבו: שלום מרטיטה! מה אני     │   │
│  │ יכולה לעשות בשבילך היום?    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ את: מה מזג האוויר מחר?       │   │
│  └─────────────────────────────┘   │
│                                     │
│  [  🎤 דברי אתי  ]  [  ✍️ כתבי  ]  │
└─────────────────────────────────────┘
```

Conversation history **always visible**, no scroll needed for last 3 exchanges.

---

## INTERACTION DESIGN

### Sound Design
- **Mic press**: soft amber chime (300ms fade-in)
- **Recording**: gentle heartbeat pulse (not aggressive)
- **Success save**: warm 3-note ascending chime (C-E-G, like a small bell)
- **Reminder alert**: gentle, melodic bell (not a phone alarm)
- **Error**: soft descending 2-note (gentle, not alarming)
- All sounds respect device silent mode (no sound if phone is muted)

### Motion Design
- **Page transitions**: 250ms fade + 12px vertical slide (gentle, not jarring)
- **Card appears**: 200ms ease-out pop-in (scale 0.96 → 1.0)
- **Button press**: 120ms scale 0.96 (immediate physical feedback)
- **Reminder popup**: 300ms cubic-bezier bounce (warm, not clinical)
- **Calendar day select**: 180ms expand (the day grows slightly)
- **Reduce motion**: All animations disable when OS preference is "reduce motion"

### Haptics (if device supports)
- Button tap: light impact (15ms)
- Successful save: medium impact + success notification pattern
- Error: soft warning pattern (not sharp)
- Reminder alert: rhythmic pattern (3 × soft vibration)

### Language & Tone
Every string Martita sees follows these rules:
1. Feminine Hebrew (את, לחצי, אמרי, תנסי)
2. First person from the app: "אני", "אדאג ל...", "אזכיר לך..."
3. No technical terms ever. "בעיה קטנה" not "שגיאה". "רגע" not "מנתחת".
4. Warmth before accuracy. "הבנתי את הרעיון, רק חסר לי התאריך" not "missing_field: date"
5. Short. Maximum 10 words per UI label. Maximum 2 sentences per message.

---

## EMOTIONAL EXPERIENCE MAP

### 7:00 — Morning
Martita opens app. It says: "בוקר טוב! היום יש לך תור לרופא בעשר. עוד 3 שעות."
She feels: **prepared, cared for.**

### 9:45 — Pre-appointment reminder
Popup: "🏥 עוד 15 דקות — תור לרופא שיניים!"
She feels: **safe, on time.**

### 12:00 — Family photo arrives via gallery
Gallery shows new photo from Mor. She taps to view.
She feels: **connected, not alone.**

### 17:00 — Sets tomorrow's reminder by voice
"תזכירי לי מחר לקחת כדור בשמונה בבוקר"
The app responds: "בסדר! אזכיר לך מחר בבוקר. 💊"
She feels: **understood, capable.**

### 21:00 — Evening medication reminder
Popup: "💊 כדור ערב. כמו תמיד."
(Warm, familiar tone for recurring reminders)
She feels: **routine, safe.**

---

## PRODUCTION INFRASTRUCTURE REQUIREMENTS

For this vision to be real, these are non-negotiable:

1. **Web Push Notifications** — ServiceWorker + PushManager + Notification API
2. **Background reminder engine** — Service Worker with periodic background sync
3. **Offline-capable calendar** — IndexedDB + cache-first strategy for all writes
4. **Voice API fallback** — Graceful degradation to manual when voice API unavailable
5. **Annual recurring events** — Birthday/anniversary repeating reminders engine
6. **Family data integration** — Birthdays from family_data.json auto-populate calendar
7. **Auto-morning briefing** — Push notification at 7am: "היום יש לך 2 אירועים"
8. **Appointment sharing** — Native Share API → WhatsApp pre-fill
