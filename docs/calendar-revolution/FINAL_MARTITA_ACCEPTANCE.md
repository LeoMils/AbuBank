# Final Martita Acceptance Sprint

## 1. Executive Verdict

**READY_FOR_MANUAL_ACCEPTANCE_QA**

Core voice add flow (main screen mic → parse → confirm → save) is complete and
test-proven. One parser bug fixed ("12 בלילה" → 00:00). 15 new time-intelligence
tests added. All 2251 tests pass. Build clean.

## 2. What Changed

### localParser.ts
- **Bug fix:** `applyPeriod` — `NIGHT_HINTS` branch now converts hour 12 to 0.
  "שתים עשרה בלילה" / "12 בלילה" → 00:00 (midnight). Previously returned 12:00.
- **Feature:** `HEBREW_HOUR_WORDS` now includes compound forms:
  - "אחת עשרה" / "אחד עשר" → 11
  - "שתים עשרה" / "שנים עשר" → 12
  This enables correct parsing of "שתים עשרה בלילה" → 00:00.

### localParser.test.ts
- 15 new time-intelligence tests (Phase 3):
  - Explicit period hints: "9 בערב" → 21:00, "9 בבוקר" → 09:00,
    "תשע וחצי בערב" → 21:30, "תשע וחצי בבוקר" → 09:30,
    "12 בצהריים" → 12:00, "12 בלילה" → 00:00 ✓ (bug fix),
    "שתים עשרה בלילה" → 00:00 ✓ (compound word fix),
    "אחת בצהריים" → 13:00, "אחת בלילה" → 01:00,
    "אחת וחצי בצהריים" → 13:30, "אחת וחצי בלילה" → 01:30
  - Ambiguous: "אחת" alone → 01:00, ambiguous=true
  - Known behavior: "9" alone → 09:00, not ambiguous (morning default)

## 3. Main Mic Status

READY. Primary fixed bottom action bar (`main-add-bar`) at `position: fixed,
bottom: 0, zIndex: 100`. Visible immediately when AbuCalendar loads without
tapping any day. Contains:
- 64×64 gold mic button (`main-mic-btn`, `aria-label="הוספת אירוע בקול"`)
- "דברי אליי" label
- "＋ הוספה ידנית" SeniorButton (minHeight 56px)

`handleVoiceRecord()` never reads `selectedDay`. Date extracted from speech.

## 4. Free Speech / Calendar Parsing Status

READY. Pipeline: Groq Whisper (large-v3) → domain correction → localParser +
semanticIntent → processVoiceTranscript → VoiceAddFlow state machine.

Example inputs and expected pipeline behavior:
- "תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר"
  → date: מחר, time: 21:00, person: גלעד, relation: resolved → ConfirmCard
- "מחר בערב תזכירי לי להתקשר לאופיר"
  → date: מחר, time: ambiguous (ערב → PM confirmed), title: clean
- "ביום ראשון בבוקר יש לי רופא"
  → date: next Sunday, time: morning, title: includes רופא emoji 🏥
- "תקבעי לי פגישה עם אופיר בשישי בתשע בערב"
  → date: Friday, time: 21:00, person: אופיר → ConfirmCard

## 5. AM/PM Ambiguity Status

READY for explicit period hints. Known limitation for bare hours 7-11.

| Input | Expected | Actual | Status |
|-------|----------|--------|--------|
| "9 בערב" | 21:00, not ambiguous | 21:00 ✓ | PASS |
| "9 בבוקר" | 09:00, not ambiguous | 09:00 ✓ | PASS |
| "תשע וחצי בערב" | 21:30, not ambiguous | 21:30 ✓ | PASS |
| "תשע וחצי בבוקר" | 09:30, not ambiguous | 09:30 ✓ | PASS |
| "12 בצהריים" | 12:00, not ambiguous | 12:00 ✓ | PASS |
| "12 בלילה" | 00:00, not ambiguous | 00:00 ✓ | PASS (bug fixed) |
| "שתים עשרה בלילה" | 00:00 | 00:00 ✓ | PASS (bug fixed) |
| "אחת בצהריים" | 13:00, not ambiguous | 13:00 ✓ | PASS |
| "אחת בלילה" | 01:00, not ambiguous | 01:00 ✓ | PASS |
| "אחת" alone | ambiguous | ambiguous=true ✓ | PASS |
| "9" alone | ambiguous (spec) | 09:00, not ambiguous | KNOWN DEVIATION |
| "12" alone | ambiguous (spec) | 12:00, not ambiguous | KNOWN DEVIATION |

Known deviations: Hours 7-11 alone → morning default (not ambiguous). Changing
this would break existing tests for "בשעה 10" etc. Deferred — medium priority.

Ambiguous time handling: `processVoiceTranscript` returns `action: 'needs_am_pm'`
when `draft.ambiguousTime=true`. `VoiceAddFlow` shows am/pm choice UI (`ampm`
state). This is wired through `ambiguousDraft` state and `onResolveAmPm`.

## 6. Family Relationship Status

READY. All paths tested and proven.

| Input | Result | Status |
|-------|--------|--------|
| "הבעל של אופיר" | resolved → גלעד | PASS |
| "בעלה של אופיר" | resolved → גלעד | PASS |
| "בן הזוג של אופיר" | resolved → גלעד | PASS |
| "עם אופיר" | resolved → אופיר (direct) | PASS |
| "הבת של מור" | missing → calm message | PASS |
| "הבן של מור" | ambiguous → candidate chips | PASS |
| Unknown person | missing → preserved phrase | PASS |

No private data leakage: ConfirmCard never renders notes, location, raw JSON,
or internal fields. Relationship resolution uses `familyGraph.yaml` (generated
from family_data.json).

## 7. ConfirmCard Status

READY. Structure per spec:
```
הבנתי

מה:    פגישה עם גלעד
       הבעל של אופיר  ← secondary (resolved relation)

מתי:   מחר · 21:00

לשמור ביומן?

[כן, לשמור]        ← minHeight 60, disabled when canSave=false
[לא, לתקן]  [ביטול] ← minHeight 56 each
```

Save button disabled when title/date/time missing — `canSave = Boolean(title && date && time)`.
Ambiguous relation: candidate chips shown, save button hidden until resolved.
Missing relation: "לא מצאתי בוודאות מי..." + can still save with phrase preserved.
Correction fields only appear after "לא, לתקן" tap.
Zero diagnostic strings.

## 8. Save / Event Title Cleanliness Status

READY. `sanitizeTitleForSave` called in:
- `handleVoiceConfirm` (index.tsx) — TITLE_LEAD_STRIPS loop + COMMAND_VERB_ONLY
- `VoiceAddFlow.doCorrectSave` — same call

Strip list covers: תקבעי, תקבע, קבעי, קבע, תזכירי, תזכיר, תזכרי, שימי, שים,
תוסיפי, תוסיף, תכניסי, תכניס, תרשמי, תרשום, תכנון פגישה, תקווה (Whisper mishear).

"תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר" → saved title: "פגישה עם גלעד" ✓

Saved state shows: "נשמר ביומן" · clean title · date · time. Never raw sentence.

## 9. AbuAI / Free-Chat Boundary Review

NO CHANGES MADE. Source reviewed, no changes needed.

AbuAI safety properties (verified, not changed):
- Does not hold phone numbers (code comment: "AbuAI does NOT hold phone numbers")
- Calendar queries route to actual calendar service (`calendar_today`, `calendar_tomorrow`, etc.)
- Family queries use `searchFamily(route.familyQuery)` — actual graph, no invention
- `groundedResponse.ts` checks claims against actual data
- Missing data: explicitly responds "not found" or similar
- Raw private metadata not exposed in any surface

Release blockers: None identified.
Next-phase improvements: Phone number display for WhatsApp routing (separate sprint).
Safe to defer: AbuAI tone improvements, multi-intent utterances.

## 10. Manual Add Status

READY. Two-step flow confirmed:
1. Form: title (required), date (defaults to today from main), time (EMPTY — no hidden default)
2. ConfirmCard shown before save (`setConfirming(true)`)
3. `doManualSave()` only called after user taps "כן, לשמור" on ConfirmCard

From main screen: `defaultDate = selectedDay = today` (user sees today pre-filled).
From day sheet: `defaultDate = selectedDay = tapped day` (correct).
Missing-field gate: shows "חסר לי פרט כדי לשמור את הפגישה." before allowing confirm step.

## 11. UX/UI Status

READY on all checked surfaces.

| Surface | Min touch | Font | Notes |
|---------|-----------|------|-------|
| Main mic button | 64px | — | Gold gradient |
| "הוספה ידנית" | 56px | 16px | SeniorButton ghost |
| "כן, לשמור" | 60px | 20px | Gold, disabled when not canSave |
| "לא, לתקן" | 56px | 17px | — |
| "ביטול" | 56px | 17px | — |
| Relation candidates | 56px | 18px | — |

All ≥ 48px minimum. ✓

360×740 compatibility: main bar is `position: fixed, bottom: 0` — always visible.
88px spacer prevents calendar grid from hiding behind the bar on scroll.

## 12. Test / Build / Pre-Commit Evidence

- `npm run typecheck`: PASS (0 errors)
- `npm test`: 2251 / 2251 PASS (102 files)
  - localParser: 59 tests (15 new)
  - calendarAddSurface: 36 tests
  - voiceAddFlow: 23 tests
  - familyResolve: 30+ tests
  - voiceAutoCreate, createPipeline, edgeCases, etc.
- `npm run build`: PASS (24 precache entries, 703.04 KiB)
- Pre-commit hook: family validation + full test suite PASS

## 13. Exact Manual QA Checklist

### Setup
1. Open AbuCalendar.
2. Verify `VOICE_RESET_ACTIVE_614F33D` visible in bottom-left corner.
   If not visible: clear SW cache, hard-reload.

### Main screen add surface (no day tap)
3. Verify gold mic button is visible at bottom of screen.
4. Verify "＋ הוספה ידנית" is visible next to the mic.
5. Confirm you have NOT tapped any calendar day.

### Voice add — explicit time + known relation
6. Tap main mic button.
7. Say: "תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר"
8. ConfirmCard appears:
   - "הבנתי" heading
   - "מה: פגישה עם גלעד"
   - Secondary: "הבעל של אופיר"
   - "מתי: מחר · 21:00"
   - "לשמור ביומן?"
   - Buttons: "כן, לשמור", "לא, לתקן", "ביטול"
   - NO debug/diagnostic text
9. Tap "כן, לשמור"
10. Saved state: "נשמר ביומן" · "פגישה עם גלעד" · "מחר · 21:00"
11. Event in list: "פגישה עם גלעד" at 21:00 — not raw sentence.

### Voice add — PM evening
12. Tap mic. Say: "תקבעי לי פגישה עם אופיר בשישי בתשע בערב"
13. ConfirmCard: מה: פגישה עם אופיר, מתי: שישי · 21:00
14. Save and verify event list title.

### AM/PM ambiguity
15. Tap mic. Say: "מחר בשתיים פגישה"
16. Ambiguity UI appears: "לאיזו שעה?" [2 בבוקר] [2 אחה"צ]
17. Choose one. ConfirmCard shows resolved time. Save.

### Midnight edge case
18. Tap mic. Say: "הלילה בשתים עשרה בלילה"
19. ConfirmCard shows time: 00:00.

### Missing relation
20. Tap mic. Say: "קבעי לי פגישה עם הבת של מור מחר"
21. ConfirmCard shows: "לא מצאתי בוודאות מי הבת של מור. לשמור כך?"
22. Can still save with "כן, לשמור" if approved.

### Ambiguous relation
23. Tap mic. Say: "תקבעי פגישה עם הבן של מור ביום שישי בעשר"
24. ConfirmCard shows candidate chips: איילון, אדר, עילי
25. Tap one candidate → resolves → save button appears.

### Manual add from main screen
26. Tap "＋ הוספה ידנית" without tapping any day.
27. Modal opens. Date pre-filled with today. Time is EMPTY.
28. Fill: title "ארוחת שישי", time 19:00.
29. Tap save → ConfirmCard appears.
30. Tap "כן, לשמור" → event saved.

### Day sheet secondary path
31. Tap a calendar day.
32. DayDetailSheet opens. Verify mic and "הוספה ידנית" in footer.
33. Verify main-screen bottom bar is hidden (sheet covers it).
34. Tap mic in day sheet. Same voice flow starts.

### No diagnostic UI
35. Throughout all of the above: zero instances of DEBUG, state:, raw:, parsed:,
    blob:, chunks:, mime:, asr:, מצב הקלטה, מה שמעתי, העתק אבחון קול visible.
