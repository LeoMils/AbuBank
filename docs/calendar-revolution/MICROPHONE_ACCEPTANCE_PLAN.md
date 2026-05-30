# MICROPHONE ACCEPTANCE PLAN
## First 20 Live-Mic Utterances to Verify the Text Pipeline End-to-End

**Pre-condition:** TEXT_PIPELINE_GREEN_READY_FOR_MIC_QA.
**Current pre-condition state:** ✅ MET.
- 2407 / 2407 unit tests passing.
- 250 fixtures, 0 intent-detection divergences.
- 30 golden Martita semantic tests passing.

**Mic QA prerequisites (operator):**
1. Run on `feat/calendar-revolution` HEAD.
2. Verify DEV marker matches `git log --oneline -1`.
3. Force-refresh the page (Cmd-Shift-R / Ctrl-Shift-R).
4. Open dev tools → Application → Service Workers → ensure no stale SW
   is registered, or trigger the auto-unregister hook.
5. Open dev tools → Network → throttle to "Fast 3G" once during QA to
   ensure offline messaging is friendly (out of scope today —
   document any technical leakage).
6. Headphones recommended to avoid acoustic feedback while testing.

**Recording per utterance (use a shared sheet):**

```
mic-qa-NN
  utterance text (Hebrew)
  expected RAW_TRANSCRIPT (target — ASR may vary)
  expected NORMALIZED_TRANSCRIPT
  expected ROUTE
  expected SEMANTIC_DRAFT (key fields: title, date, time, person)
  expected CARD: appointment / reminder / family / calendar / unknown
  expected SAVE BEHAVIOR: save_allowed | blocked(reason) | query (no save)
  ACTUAL raw transcript (paste from VoiceTraceCard)
  ACTUAL normalized
  ACTUAL route
  ACTUAL card title shown to user
  ACTUAL save behavior
  PASS / FAIL / NEEDS REVIEW
  FAILURE CLASS (if FAIL): ASR | NORMALIZATION | ROUTE | DATE | TIME | PERSON | TITLE | CARD | SAVE
  FOLLOW-UP NOTE
```

---

## THE 20 UTTERANCES

### 1. Appointment with full fields + family relation
- **Say:** תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר
- **Expected route:** appointment_create
- **Expected fields:** date=tomorrow, time=21:00, person=גלעד (resolved)
- **Expected card:** appointment ConfirmCard "לקבוע פגישה עם גלעד מחר בתשע בערב?"
- **Save:** allowed

### 2. Appointment with sister relation
- **Say:** תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי
- **Expected route:** appointment_create
- **Expected fields:** date=tomorrow, time=21:30, person=resolved/missing/ambiguous (honest)
- **Save:** allowed if resolved; blocked with reason if missing/ambiguous

### 3. Short relative-time reminder
- **Say:** תזכירי לי בעוד שתי דקות לקחת כדור
- **Expected route:** reminder_create
- **Expected fields:** label="בעוד 2 דקות", title contains "לקחת כדור"
- **Card:** reminder ConfirmCard
- **Save:** allowed

### 4. Self-correction (relative time)
- **Say:** בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה
- **Expected normalized:** בעוד שתי דקות להתקשר למשה
- **Expected route:** reminder_create
- **Save:** allowed; title clean ("התקשר למשה" or "להתקשר למשה")

### 5. Manual-style "תוסיפי" addition
- **Say:** תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים
- **Expected route:** appointment_create
- **Expected fields:** date=Sunday next, time=14:00, title="תור לתופרת"
- **Save:** allowed

### 6. Calendar query
- **Say:** מה התוכניות שלי השבוע
- **Expected route:** calendar_query
- **Card:** schedule view / "כן, להציג?"
- **Save:** N/A (query)

### 7. Family query (no save)
- **Say:** מי הבעל של אופיר
- **Expected route:** family_query
- **Card:** answer "גלעד הוא הבעל של אופיר" (read-only)
- **Save:** N/A

### 8. Reminder to call a relation
- **Say:** תזכירי לי להתקשר לבעל של אופיר בערב
- **Expected route:** reminder_create
- **Expected fields:** time bucket=evening (block save if no specific time)
- **Save:** blocked (missing time) OR allowed (if "בערב" interpreted as ~20:00); verify the bucket behavior

### 9. Ambiguous time alone (must NOT silently save)
- **Say:** מחר בתשע
- **Expected route:** unknown OR reminder (no save)
- **Save:** MUST be blocked — no enough info to know what to do.

### 10. Same with evening context
- **Say:** מחר בתשע בערב
- **Expected route:** unknown (no task / no appointment noun)
- **Save:** blocked

### 11. Midnight (12 בלילה)
- **Say:** תזכירי לי מחר ב-12 בלילה לקחת תרופה
- **Expected route:** reminder_create
- **Expected time:** 00:00 (midnight, NOT 12:00)
- **Save:** allowed

### 12. One in the afternoon
- **Say:** תזכירי לי מחר באחת בצהריים לקחת כדור
- **Expected route:** reminder_create
- **Expected time:** 13:00 (NOT 01:00)
- **Save:** allowed

### 13. "Quarter to ten in the evening"
- **Say:** תזכירי לי מחר ברבע לעשר בערב לכבות תנור
- **Expected route:** reminder_create
- **Expected time:** 21:45
- **Save:** allowed
- **KNOWN GAP RISK:** "רבע ל" parsing may not be fully supported; if
  the card shows 22:00 or "ambiguous", file as KNOWN_GAP.

### 14. Recurring daily without trigger
- **Say:** כל יום בתשע בבוקר לקחת תרופה
- **Expected route:** reminder_create (recurring)
- **Expected fields:** recurrence.frequency='daily', time=09:00
- **Save:** allowed (recurring)

### 15. "אני צריכה" + תזכירי לי
- **Say:** אני צריכה מחר בבוקר לקחת כדור תזכירי לי
- **Expected route:** reminder_create
- **Expected fields:** date=tomorrow, time-of-day bucket=morning
- **Save:** blocked if no specific time; allowed if morning interpreted as default

### 16. Negative-form reminder
- **Say:** אל תשכחי להזכיר לי בערב להתקשר לאופיר
- **Expected route:** reminder_create
- **Save:** blocked if evening lacks specific time

### 17. Time correction (תשע → עשר)
- **Say:** תזכירי לי מחר בתשע לא סליחה בעשר לקחת כדור
- **Expected normalized:** מחר בעשר לקחת כדור (or equivalent)
- **Expected time:** 10:00 (NOT 09:00)
- **Save:** allowed

### 18. Person correction (גלעד → אופיר)
- **Say:** תקבעי עם גלעד מחר לא עם אופיר מחר
- **Expected normalized:** תקבעי עם אופיר מחר
- **Expected route:** appointment_create
- **Expected person:** אופיר
- **Save:** allowed if remaining time/date are present; otherwise blocked with reason

### 19. Empty / silence
- **Say:** (silence for full timeout)
- **Expected:** auto-stop after 4s; intent=unknown; no save; friendly "לא שמעתי, תנסי שוב?"
- **Save:** N/A

### 20. Cancel
- **Say:** ביטול
- **Expected behavior:** active flow cancels; nothing saved.
- **Save:** N/A

---

## FAILURE LOGGING FORMAT

For every FAIL or NEEDS REVIEW, log a single row:

```
mic-qa-NN | utterance | failure_class | raw | normalized | route | card | save | repro_steps | proposed_fix
```

Keep `repro_steps` to ≤ 3 bullets. `proposed_fix` may say "unknown —
needs investigation."

---

## EXIT CRITERIA

Mic QA is GREEN when:
- All 20 utterances PASS, OR
- All FAILs are either:
  - explicitly logged as KNOWN_GAP with a follow-up issue, AND
  - none are class CARD or class SAVE (those are catastrophic
    surface-level failures — must be P0 fixed before declaring green).

---

## VERDICT TODAY (pre-mic-QA, post-text-pipeline)

`TEXT_PIPELINE_GREEN_READY_FOR_MIC_QA` ✅

Operator may proceed to live-mic QA on `feat/calendar-revolution`.
Do NOT report results as "production ready" — production reliability
depends on the Service Worker / Push work documented in
`RELIABILITY_REALITY_CHECK.md`.
