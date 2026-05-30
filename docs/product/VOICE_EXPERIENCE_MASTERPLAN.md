# VOICE EXPERIENCE MASTERPLAN
## The Ideal Voice UX for an 80+ User

**From first press to completion — every state, every failure, every recovery.**

---

## DESIGN PRINCIPLES FOR SENIOR VOICE UX

**Principle 1: One job per session.**
When Martita presses mic, the app does ONE thing. Not route to reminder vs calendar vs AI. One voice, one outcome, one confirmation.

**Principle 2: The app speaks first.**
Before Martita speaks, the app says a prompt. She always knows what to say.

**Principle 3: Auto-stop.**
Never make an 80-year-old figure out when to stop recording. 4 seconds of silence = done.

**Principle 4: Three states visible, nine states invisible.**
The pipeline has 9 internal states. Martita sees 3: listening → thinking → done.

**Principle 5: Failure is never Martita's fault.**
Every error message says "nnסי שוב" (try again), never "there was an error."

**Principle 6: Voice confirmation, not just text.**
When the app saves something, it speaks back: "שמרתי — תור לרופא מחר בעשר."

---

## PRE-RECORDING: DISCOVERY

### Problem
Martita doesn't know voice input exists. The mic button is inside a sheet.

### Solution
Microphone button must be:
- **Visible on every calendar/reminder screen without any tapping**
- **Labeled** — not just an icon; also shows text: "🎤 דברי אתי"
- **Pulsing gently** on first 3 uses (discovery animation)
- **Accompanied by first-use tooltip** after install

### First Use Tooltip (shown once, 5 seconds)
```
┌─────────────────────────────────────┐
│  💡 ידעת?                           │
│  אפשר לקבוע פגישות בקול!            │
│  לחצי על הכפתור הכתום ואמרי לדוגמה: │
│  "תקבעי לי תור לרופא מחר בעשר"     │
│                          [הבנתי]    │
└─────────────────────────────────────┘
```

---

## THE RECORDING STATE: DETAILED

### Trigger
User taps the amber microphone button.

### Immediate Response (< 100ms)
- Haptic: medium impact (15ms vibration)
- Sound: soft ascending chime (300ms)
- Screen: recording modal slides up

### Visual State
```
╔═══════════════════════════════════════╗
║                                       ║
║                                       ║
║            🎙                         ║
║         ████████                      ║  ← Waveform: animated bars responding to voice volume
║         ████████                      ║    (NOT a flat animation — real audio level display)
║                                       ║
║   אני מקשיבה לך...                   ║  ← 28px, warm cream, centered
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  לדוגמה:                        │  ║  ← Rotating example utterance
║  │  "תזכירי לי מחר לקחת כדור"     │  ║    Changes every 3 seconds while waiting
║  └─────────────────────────────────┘  ║
║                                       ║
║  ──────────────── ████░░  שקט: 2שנ   ║  ← Auto-stop countdown
║  (resets to 4s when voice detected)   ║
║                                       ║
║  [         ⏹  סיימתי         ]        ║  ← 72px, full-width, amber
║  [  ✕ ביטול  ]                        ║  ← 48px, ghost, below
║                                       ║
╚═══════════════════════════════════════╝
```

### Silence Detection
```
Audio RMS threshold: < 0.01 (quiet)
Silence duration: 4 seconds
When triggered: auto-advance to processing (same as manual stop)

Visual feedback:
  0-2s silence: bar shows full gray
  2-4s silence: bar shrinks to show countdown
  4s: auto-advance (gentle chime)
```

### What Happens Internally (invisible to user)
1. MediaRecorder API captures WebM/opus audio
2. Running RMS calculation every 100ms
3. 4s silence timer reset on each non-silent chunk

### Error: No Microphone Permission
**Detected before opening modal:**
```
┌─────────────────────────────────────┐
│  🎤 צריך גישה למיקרופון              │
│                                     │
│  כדי להוסיף אירועים בקול,           │
│  יש לאפשר גישה למיקרופון            │
│  בהגדרות הדפדפן.                    │
│                                     │
│  [  כך עושים זאת  ]                  │  ← Opens instructions
│  [  הוסיפי ידנית  ]                  │  ← Fallback
└─────────────────────────────────────┘
```

### Error: No Audio Captured (< 500 bytes)
```
┌─────────────────────────────────────┐
│  לא שמעתי כלום...                   │
│                                     │
│  תנסי שוב — קרוב יותר              │
│  למיקרופון                          │
│                                     │
│  [  נסי שוב  ]  [  הוסיפי ידנית  ] │
└─────────────────────────────────────┘
```

---

## THE PROCESSING STATE: DETAILED

### NEVER show this longer than 3 seconds
If processing takes longer than 3s: show a warm progress indicator.
If longer than 10s: show elapsed time.

### Visual State (0–3 seconds)
```
╔═══════════════════════════════════════╗
║                                       ║
║              ⋯  ⋯  ⋯                 ║  ← Three amber dots, wave animation
║                                       ║
║         רגע אחד...                   ║  ← 22px warm cream
║                                       ║
╚═══════════════════════════════════════╝
```

### Visual State (3–15 seconds)
```
╔═══════════════════════════════════════╗
║                                       ║
║              ⋯  ⋯  ⋯                 ║
║                                       ║
║         מנתחת... (7 שניות)            ║  ← Shows elapsed time after 3s
║                                       ║
╚═══════════════════════════════════════╝
```

### Error: Transcription Timeout (> 20 seconds)
```
┌─────────────────────────────────────┐
│  קצת לקח יותר מהרגיל...             │
│                                     │
│  אפשר לנסות שוב, או להוסיף ידנית   │
│                                     │
│  [  נסי שוב  ]  [  הוסיפי ידנית  ] │
└─────────────────────────────────────┘
```

### Error: API Unavailable
```
┌─────────────────────────────────────┐
│  רגע, לא מצליחה להתחבר...           │
│                                     │
│  בדקי שיש חיבור לאינטרנט            │
│                                     │
│  [  נסי שוב  ]  [  הוסיפי ידנית  ] │
└─────────────────────────────────────┘
```

---

## THE CONFIRMATION STATE: DETAILED

### Appointment Fully Parsed
```
╔═══════════════════════════════════════╗
║                                       ║
║  הנה מה שהבנתי:                      ║  ← 22px, warm
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │                                 │  ║
║  │  📅  מחר, שבת 30 במאי          │  ║  ← 20px, DATE
║  │  🕐  10:00 בבוקר                │  ║  ← 20px, TIME
║  │  🏥  תור לרופא שיניים           │  ║  ← 20px BOLD, TITLE
║  │                                 │  ║
║  │  ─────────────────────────────  │  ║
║  │  [🎤 שנגי מה שאמרת]             │  ║  ← Re-record, small ghost button
║  └─────────────────────────────────┘  ║
║                                       ║
║  [        ✓ כן, לשמור       ]         ║  ← 72px, full-width, amber gradient
║                                       ║
║  [   ✏️ לתקן ידנית   ]                ║  ← 48px, ghost, less prominent
║                                       ║
╚═══════════════════════════════════════╝
```

**Voice readback when confirmation appears:**
App says (quietly, not intrusive): "מחר בשעה עשר, תור לרופא שיניים. לשמור?"
This lets Martita confirm by ears, not just eyes.

### AM/PM Disambiguation
This is the most cognitively demanding moment. Design it carefully.

```
╔═══════════════════════════════════════╗
║                                       ║
║  שאלה אחת קטנה:                      ║
║                                       ║
║  אמרת "שלוש" —                        ║
║  כוונתך:                              ║
║                                       ║
║  ┌──────────────────┐                 ║
║  │                  │                 ║
║  │  ☀️  3:00         │                 ║  ← Left button: AM
║  │  שלוש בלילה      │                 ║  ← Explicit label
║  │  (03:00)         │                 ║  ← 24h for clarity
║  │                  │                 ║
║  └──────────────────┘                 ║
║  ┌──────────────────┐                 ║
║  │                  │                 ║
║  │  🌅  15:00        │                 ║  ← Right button: PM
║  │  שלוש אחר הצהריים│                 ║
║  │  (15:00)         │                 ║
║  │                  │                 ║
║  └──────────────────┘                 ║
║                                       ║
╚═══════════════════════════════════════╝
```

Both buttons stacked vertically (not side-by-side) — easier to differentiate.
App speaks both options: "שלוש בלילה, או שלוש אחר הצהריים?"

### Missing Field Recovery

Not treated as an error. A continuation of the conversation.

**Missing date:**
```
הבנתי שרוצי תור לרופא שיניים.
מתי זה?

[  היום  ]  [  מחר  ]  [  בחרי תאריך  ]
```
Tapping "בחרי תאריך" → simple calendar popup.

**Missing time:**
```
הבנתי — תור לרופא שיניים מחר.
באיזה שעה?

[  09:00  ]  [  10:00  ]  [  11:00  ]  [  שעה אחרת  ]
```
Shows 3 common times for the time of day (morning options in morning, afternoon in afternoon).

**Missing title:**
```
הבנתי מחר בעשר, אבל לא הבנתי מה.
מה האירוע?

[  רופא  ]  [  פגישה  ]  [  תור  ]  [  הקלידי  ]
```
Shows 3 common quick-fills. Tap one = fills the title field.

### Person Ambiguity
```
╔═══════════════════════════════════════╗
║                                       ║
║  הבנתי "הבת של מור" —                ║
║  למי התכוונת?                        ║
║                                       ║
║  ┌───────────┐   ┌───────────┐        ║
║  │ [שרה]     │   │ [כלי]     │        ║  ← Family photos if available
║  │  שרה      │   │  כלי      │        ║  ← Names, large
║  └───────────┘   └───────────┘        ║
║                                       ║
║  [  לשמור בלי שם ספציפי  ]           ║  ← Ghost fallback
║                                       ║
╚═══════════════════════════════════════╝
```

If family photos exist → show them. Names instantly recognizable with photos.

### Family Resolution Success
```
מצאתי: "הבת של מור" = שרה ✓
האירוע יישמר עם השם שרה.
```
No extra screen for this. Just a note in the confirmation card.

---

## THE SUCCESS STATE

### Visual
```
╔═══════════════════════════════════════╗
║                                       ║
║              ✓                       ║  ← Large green checkmark, animated draw
║                                       ║
║         נשמר!                        ║  ← 32px Heebo Bold
║                                       ║
║  ┌─────────────────────────────────┐  ║
║  │  תור לרופא שיניים              │  ║
║  │  מחר, שבת 30 במאי              │  ║
║  │  10:00 בבוקר                   │  ║
║  └─────────────────────────────────┘  ║
║                                       ║
║  [  הצגי ביומן  ]                    ║  ← Jump to the saved event
║                                       ║
╚═══════════════════════════════════════╝
(Auto-closes after 4 seconds)
```

### Audio
App speaks: "שמרתי — תור לרופא שיניים מחר בעשר. כל הכבוד!"
(Two sentences max. Warm, personal. Uses Martita's nickname.)
Sound: 3-note ascending chime (soft, pleasant).

### Haptic
Medium impact + success notification pattern.

---

## ALL ERROR STATES

| Situation | Visual Message | Audio | Next Action |
|-----------|---------------|-------|-------------|
| No mic permission | "צריך גישה למיקרופון" + how-to | Soft tone | Instructions + manual |
| No audio captured | "לא שמעתי כלום" | Soft tone | Try again + manual |
| Too short / noise | "שמעתי רעש אבל לא מילים" | Soft tone | Try again + manual |
| API timeout | "קצת לקח יותר מהרגיל" | Soft tone | Try again + manual |
| API unavailable | "לא מצליחה להתחבר" | Soft tone | Check internet + manual |
| Low confidence | "לא בטוחה שהבנתי נכון" | — | Show confirmation with warning |
| Unknown intent | "לא הבנתי מה רוצי לעשות" | — | Show 3 common actions |
| Save failed | "קרתה בעיה בשמירה" | — | Try again + manual |

**Universal error rule:** Never say what went wrong internally. Always say what Martita can do next.

---

## REMINDER VOICE CREATION (SEPARATE FLOW)

When intent = reminder, voice flow continues into reminder creation:

### After voice capture
```
הבנתי שרוצי תזכורת.

  💊  לקחת כדור לחץ דם
      בעוד שעה (15:30)

  🔔 אשמיע צליל גם כשהאפליקציה סגורה

[    כן, אזכרי לי    ]    ← Primary
[ לתקן ]                  ← Secondary
```

Same flow for recurring:
```
  💊  לקחת כדור לחץ דם
      כל יום בשעה 09:00
      🔁 תזכורת חוזרת

[    אזכרי לי כל יום    ]
```

---

## SCHEDULE QUERY FLOW

When intent = schedule_query:
```
Input: "מה קורה לי מחר?"

Response (voice + visual):
╔═══════════════════════════════════════╗
║  מחר, שבת 30 במאי                    ║
║                                       ║
║  🏥  10:00  תור לרופא שיניים          ║
║  👨‍👩‍👧  18:00  ארוחת שבת               ║
║                                       ║
║  ── 2 אירועים ──                     ║
╚═══════════════════════════════════════╝
```

App speaks: "מחר יש לך שני דברים: תור לרופא שיניים בעשר, וארוחת שבת בשש בערב."

---

## VOICE ACCESSIBILITY CONSIDERATIONS

### For users with tremors
- Button press area: 72×72px minimum — easy to land
- Auto-stop: removes need for precise tap timing
- No time pressure: recording continues until silence

### For users with hearing loss
- All audio feedback has VISUAL equivalents
- No audio-only information: everything also shown on screen
- Larger vibration patterns for hearing aid users

### For users with mild cognitive impairment
- Single-focus screens: one thing at a time
- Progressive disclosure: don't show all options at once
- Confirmation always required before saving
- Easy undo: 6-second toast after save

### For users with low vision
- All text ≥ 18px in voice flow
- High contrast: cream on deep amber/black
- Large state indicators (not just text badges)
- No color-only differentiation

---

## PERFORMANCE REQUIREMENTS

| Stage | Maximum Acceptable Time | User Expectation |
|-------|------------------------|------------------|
| Mic button press → recording starts | 200ms | Instant |
| Recording stop → processing starts | 300ms | Instant |
| Short transcript (< 3s audio) | 3 seconds | Fast |
| Normal transcript (3–10s audio) | 6 seconds | "Takes a moment" |
| Long transcript (> 10s audio) | 12 seconds | Visible progress |
| Parse/understand | 500ms | Instant |
| Save to storage | 200ms | Instant |

**If Whisper API consistently takes > 8 seconds:** show "מנסה שוב מהר יותר" and fall back to a faster ASR model (Whisper turbo).
**If Whisper API is unavailable:** Show manual form immediately. Never leave user waiting for a dead API.

---

## FIRST-USE CALIBRATION

First time a user opens voice:
1. Play a sample: App says "נסי לומר: תקבעי לי תור לרופא מחר בעשר בבוקר"
2. User records
3. If successful: positive reinforcement
4. If failed: offer manual path with "זה לוקח קצת הרגל, ממשיכים ביחד"

After 3 successful voice entries: remove the example prompt. User has learned.
After 1 failed voice entry: offer "להוסיף ידנית?" button more prominently.

---

## VOICE EXPERIENCE METRICS

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Voice creation success rate | > 80% | < 50% = product broken |
| False intent detection | < 5% | > 15% = untrusted |
| AM/PM disambiguation needed | < 20% of sessions | > 40% = time extraction broken |
| User abandons mid-flow | < 15% | > 30% = flow is too complex |
| Retry rate (same utterance) | < 10% | > 25% = audio quality issue |
| "הוסיפי ידנית" fallback rate | < 30% | > 50% = voice isn't working |
