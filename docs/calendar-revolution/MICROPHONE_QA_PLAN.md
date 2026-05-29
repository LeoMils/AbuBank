# Microphone QA Plan — Hebrew Voice Calendar Pipeline

**Branch**: feat/calendar-revolution  
**Base commit**: b227f67 (text pipeline fixes)  
**Date**: 2026-05-29  
**TODAY_ISO pinned**: 2026-05-29 (Friday)  

---

## 1. Purpose

This document is a manual QA protocol for a human tester. It exists because the text-fixture harness (`voicePipelineHarness.test.ts`) proves deterministic pipeline correctness against fixed strings but cannot test:

- Whisper ASR transcription accuracy from real audio
- Hebrew accent and natural-speech variations in the microphone path
- `cleanTranscript` behavior on actual ASR noise (fillers, hesitations, mis-splits)
- ConfirmCard and ReminderConfirmCard rendering in a live browser
- Touch target sizes, contrast, and RTL layout under real conditions

A human tester must run this protocol on a physical device with a microphone against the running dev server. No automated assertion can substitute for this pass.

---

## 2. Prerequisites

### Device
- Mobile phone (Android or iOS) or tablet on the same local network as the dev server.
- Microphone functional and unmuted.
- Browser: Chrome (Android) or Safari (iOS). Do not use desktop browser — touch target QA requires a real touchscreen.

### OS / App State
- Clear browser cache before starting (hard reload / clear site data).
- Service worker from a previous build must not be active. On iOS PWA: delete and re-add to Home Screen.
- App must be installed as PWA or opened in the browser; do not use a cached version from a previous session.

### Network
- Dev server must be accessible from the device (same LAN, or forwarded via ngrok / Claude Code ports panel).
- No VPN on the test device unless the VPN bridges to the dev server subnet.
- Stable Wi-Fi — voice recording requires a live connection to Groq ASR.

### App Running
- `npm run dev` on the host machine, dev server on port **5173** (default Vite port).
- Confirm the app loads at `http://<host-ip>:5173` on the device before beginning.
- AbuCalendar screen must be visible and the mic button must be tappable.

### Tester requirements
- Knows Hebrew or has a Hebrew speaker available to speak the utterances naturally.
- Can read the result log template and record outcomes in the table below.

---

## 3. Test Environment

| Field | Value |
|---|---|
| Branch | feat/calendar-revolution |
| Base commit | b227f67 |
| Dev server port | 5173 |
| TODAY_ISO | 2026-05-29 (Friday) |
| TOMORROW | 2026-05-30 (Saturday) |
| Next Sunday | 2026-05-31 |
| Next Monday | 2026-06-01 |
| Next Tuesday | 2026-06-02 |
| Pipeline path | Whisper ASR (Groq) → cleanTranscript → isScheduleQuery → detectReminderIntent → parseReminder / parseLocally + familyResolve |
| Fixture harness version | voicePipelineFixtures.ts at b227f67 (200+ utterances, 0 divergences) |

Fill in actual commit hash and server URL before running:

| Field | Tester fills in |
|---|---|
| Actual commit | ________ |
| Dev server URL | ________ |
| Test device | ________ |
| Tester name | ________ |
| Test date/time | ________ |

---

## 4. How to Log Results

For each utterance:

1. Open AbuCalendar.
2. Tap the microphone button.
3. Speak the utterance clearly and naturally (do not spell it out).
4. Observe: ASR transcript shown in the UI, route taken (ConfirmCard / ReminderConfirmCard / schedule display / no-op), card content, save behavior.
5. Record in the result log table (Section 6).

**Pass** = all pass criteria for that utterance are met.  
**Fail** = one or more pass criteria are not met. Record the deviation in the Notes column.  
**Partial** = partial match — note which criteria passed and which did not.

If the app crashes or shows an unhandled error, record the error message in Notes and mark Fail.

---

## 5. The 20 Utterances

---

### Utterance 1

**Say to ASR**: תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר

**Expected raw ASR transcript (approximate)**: תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר  
(Whisper may vary. Acceptable variations: "בשעה עשרים ואחת" for "21". Not acceptable: "תקווה" instead of "תקבעי".)

**Expected normalized transcript**: תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר  
(cleanTranscript should make no change to this utterance — no stutter, no self-correction, no colon spacing issue.)

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title line ("מה"): פגישה עם גלעד (or equivalent — verb stripped, resolved name substituted)
- Secondary line beneath "מה": הבעל של אופיר (the original phrase, in secondary color)
- Date line ("מתי"): מחר (2026-05-30)
- Time: 21:00
- Save button visible and enabled

**Expected save behavior**: ALLOWED — all fields present, person resolved

**Expected due popup**: n/a (appointment, not reminder)

**Pass criteria**:
- ASR transcript does not contain "תקווה" as a standalone word
- ConfirmCard shows "גלעד" (not "הבעל של אופיר") as the primary person name
- Date displayed is מחר / 30.5 (2026-05-30)
- Time displayed is 21:00
- "כן, לשמור" button is present and enabled
- Command verb "תקבעי" does not appear in the title

**Common failure modes**:
- ASR mishears "תקבעי" as "תקווה" (known ASR risk; W2 from war room)
- Time parses as 09:00 (AM/PM ambiguity fallback when "בשעה 21" is missed)
- Person phrase not resolved — shows raw phrase instead of גלעד

---

### Utterance 2

**Say to ASR**: תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי

**Expected raw ASR transcript (approximate)**: תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי

**Expected normalized transcript**: תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title: פגישה (with person line showing אחות של ארי, either resolved or preserved)
- Date: מחר (2026-05-30)
- Time: 21:30
- Person phrase: אחות של ארי preserved; resolution status is resolved, ambiguous, or missing — never invented

**Expected save behavior**: ALLOWED if person is resolved or missing (phrase preserved); BLOCKED if person is ambiguous (disambiguation UI shown)

**Expected due popup**: n/a

**Pass criteria**:
- Date is 2026-05-30 (not 2026-05-29)
- Time is 21:30 (not 09:30 — period hint "בערב" must fire)
- The phrase "אחות של ארי" appears somewhere in the card (either as resolved name or preserved phrase)
- The pipeline does not crash or silently drop the sibling phrase
- If ambiguous: candidate buttons shown, each ≥ 48px

**Common failure modes**:
- Time parsed as 09:30 (period hint "בערב" not applied to "תשע וחצי")
- Sibling phrase not captured (only "ארי" extracted)
- Date defaults to today instead of tomorrow

---

### Utterance 3

**Say to ASR**: תזכירי לי בעוד שתי דקות לקחת כדור

**Expected raw ASR transcript (approximate)**: תזכירי לי בעוד שתי דקות לקחת כדור

**Expected normalized transcript**: תזכירי לי בעוד שתי דקות לקחת כדור

**Expected route**: reminder → ReminderConfirmCard

**Expected ReminderConfirmCard content**:
- Title / action: לקחת כדור
- Time label: בעוד 2 דקות (computed from clock time at moment of test)
- Category: medication
- No command verb "תזכירי" in the title

**Expected save behavior**: ALLOWED — title present, relative time parsed

**Expected due popup**: yes — when the 2-minute timer fires, a popup/alert must appear with "לקחת כדור" as the body. Tester should wait and verify this within 3 minutes of saving.

**Pass criteria**:
- Route is reminder (not appointment or unknown)
- Title contains "לקחת כדור" and not "תזכירי"
- Time label references ~2 minutes
- Save is allowed
- Popup fires within ~2–3 minutes of save

**Common failure modes**:
- Classified as appointment (intent detection failure)
- "תזכירי" leaks into the title
- Relative time not parsed (dueAt is null, save blocked)

---

### Utterance 4

**Say to ASR**: בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה

**Expected raw ASR transcript (approximate)**: בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה

**Expected normalized transcript**: בעוד שתי דקות להתקשר למשה  
(cleanTranscript self-correction: "בעוד X סליחה בעוד Y" → "בעוד Y"; "עשר דקות" and "סליחה" must not appear in the output)

**Expected route**: unknown (no reminder trigger verb) — but normalized transcript is the critical check

**Expected ConfirmCard / ReminderConfirmCard content**: may not produce a card; the key assertion is on the normalized transcript displayed in any debug/confirmation text

**Expected save behavior**: depends on route; if unknown → BLOCKED

**Expected due popup**: n/a

**Pass criteria**:
- Normalized transcript shown in UI does NOT contain "סליחה"
- Normalized transcript shown in UI does NOT contain "עשר דקות"
- Normalized transcript is "בעוד שתי דקות להתקשר למשה" or equivalent
- The self-correction erasure is visible in the display (no partial bleed of the first clause)

**Common failure modes**:
- "סליחה" remains in the normalized transcript (cleanTranscript self-correction not applied)
- Both clauses kept ("עשר דקות" appears alongside "שתי דקות")
- ASR transcribes "סליחה" as a different word (excusable — log the ASR output)

---

### Utterance 5

**Say to ASR**: תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים

**Expected raw ASR transcript (approximate)**: תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים

**Expected normalized transcript**: תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title: תור לתופרת (command verb "תוסיפי" stripped; or "תור" alone if parser strips the preposition)
- Date: יום ראשון, 31.5 (2026-05-31 — next Sunday from Friday 2026-05-29)
- Time: 14:00 (period hint "בצהריים" resolves "שתיים" → 14:00)

**Expected save behavior**: ALLOWED

**Expected due popup**: n/a

**Pass criteria**:
- "תוסיפי" does not appear in the title
- Date is 2026-05-31 (not 2026-05-29 today, not 2026-06-07 a week later)
- Time is 14:00 (not 02:00 — period hint must fire)
- Save is allowed

**Common failure modes**:
- Date resolves to next next Sunday (7 days off)
- Time is 02:00 (period hint "בצהריים" not applied)
- "תוסיפי" or "תור לתופרת" partially leaks into title as raw text

---

### Utterance 6

**Say to ASR**: מה התוכניות שלי השבוע

**Expected raw ASR transcript (approximate)**: מה התוכניות שלי השבוע

**Expected normalized transcript**: מה התוכניות שלי השבוע

**Expected route**: schedule_query — display the week's appointments, NO ConfirmCard

**Expected ConfirmCard / ReminderConfirmCard content**: none — the app should show the weekly schedule view

**Expected save behavior**: NOT ALLOWED — no event created, no save button

**Expected due popup**: n/a

**Pass criteria**:
- No ConfirmCard appears
- No save button appears
- The app navigates to or displays the weekly schedule
- "השבוע" scope is reflected (not just today)

**Common failure modes**:
- Routes to appointment (QUERY_PATTERNS regex did not match plural "התוכניות" — was a known bug, fixed in b227f67)
- ConfirmCard shown erroneously
- App shows blank / error state

---

### Utterance 7

**Say to ASR**: מי הבעל של אופיר

**Expected raw ASR transcript (approximate)**: מי הבעל של אופיר

**Expected normalized transcript**: מי הבעל של אופיר

**Expected route**: unknown (family query — not an appointment, not a reminder, not a schedule query)

**Expected ConfirmCard / ReminderConfirmCard content**: none — the app should either show a gentle "לא הבנתי" message or route to AbuAI chat

**Expected save behavior**: NOT ALLOWED — no event created

**Expected due popup**: n/a

**Pass criteria**:
- No ConfirmCard appears
- No calendar event is created
- The app does not crash

**Common failure modes**:
- Routes as appointment ("הבעל של אופיר" extracted as person phrase, classified as appointment)
- App silently does nothing with no feedback

---

### Utterance 8

**Say to ASR**: תזכירי לי להתקשר לבעל של אופיר בערב

**Expected raw ASR transcript (approximate)**: תזכירי לי להתקשר לבעל של אופיר בערב

**Expected normalized transcript**: תזכירי לי להתקשר לבעל של אופיר בערב

**Expected route**: reminder → ReminderConfirmCard

**Expected ReminderConfirmCard content**:
- Title / action: להתקשר לגלעד (person phrase "לבעל של אופיר" resolved to "גלעד" and substituted into title)
- Time label: בערב (today evening; displayTimeLabel may be approximate — "הלילה" or time value)
- Person resolution: resolved = גלעד
- Original phrase: הבעל של אופיר or לבעל של אופיר visible as secondary

**Expected save behavior**: ALLOWED if time resolves; may be BLOCKED if "בערב" alone is insufficient (no specific hour)

**Expected due popup**: n/a (evening is same-day; no specific minute)

**Pass criteria**:
- Route is reminder
- "גלעד" appears in the title or person line (not raw "הבעל של אופיר" as primary)
- "תזכירי" does not appear in the title
- If save blocked: reason shown in Hebrew, not a raw error code

**Common failure modes**:
- Person phrase not captured with "ל" prefix (known fix in b227f67 — verify it holds in live audio)
- Classified as appointment instead of reminder
- "בערב" not resolved to a time, save blocked with no explanation

---

### Utterance 9

**Say to ASR**: יש לי פגישה עם הרופא מחר בעשר וחצי בבוקר

**Expected raw ASR transcript (approximate)**: יש לי פגישה עם הרופא מחר בעשר וחצי בבוקר

**Expected normalized transcript**: יש לי פגישה עם הרופא מחר בעשר וחצי בבוקר

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title: פגישה עם הרופא (or "פגישה" — "הרופא" is a stop word but may appear in title)
- Date: מחר (2026-05-30)
- Time: 10:30 (period hint "בבוקר" + "עשר וחצי")

**Expected save behavior**: ALLOWED

**Expected due popup**: n/a

**Pass criteria**:
- Date is 2026-05-30
- Time is 10:30 (not 22:30)
- Save allowed

**Common failure modes**:
- Time is 22:30 (period hint "בבוקר" not applied — should force AM)
- "יש לי" leaks into the title

---

### Utterance 10

**Say to ASR**: תזכירי לי כל יום בשמונה בבוקר לקחת תרופה

**Expected raw ASR transcript (approximate)**: תזכירי לי כל יום בשמונה בבוקר לקחת תרופה

**Expected normalized transcript**: תזכירי לי כל יום בשמונה בבוקר לקחת תרופה

**Expected route**: reminder → ReminderConfirmCard

**Expected ReminderConfirmCard content**:
- Title: לקחת תרופה
- Recurrence: כל יום
- Time: 08:00
- Category: medication

**Expected save behavior**: ALLOWED — recurring daily at 08:00

**Expected due popup**: popup fires at 08:00 the next morning (tester does not need to verify this in real time; confirm the saved reminder shows the recurrence label)

**Pass criteria**:
- Route is reminder
- Recurrence label "כל יום" or equivalent shown in the card
- Time is 08:00
- "תזכירי" does not appear in the title
- Save is allowed
- After saving, the reminder entry in the list shows recurring indicator

**Common failure modes**:
- Recurrence not detected (treated as one-time reminder at 08:00 today)
- Time is 20:00 (period hint "בבוקר" not applied)
- "לקחת" stripped as a command verb erroneously

---

### Utterance 11

**Say to ASR**: מה יש לי מחר

**Expected raw ASR transcript (approximate)**: מה יש לי מחר

**Expected normalized transcript**: מה יש לי מחר

**Expected route**: schedule_query — show tomorrow's appointments

**Expected ConfirmCard / ReminderConfirmCard content**: none — schedule display only

**Expected save behavior**: NOT ALLOWED

**Expected due popup**: n/a

**Pass criteria**:
- No ConfirmCard appears
- Tomorrow's schedule shown (scope: 2026-05-30)
- No save button

**Common failure modes**:
- Routes as appointment (QUERY_PATTERNS did not match "מה יש לי")
- Shows today's schedule instead of tomorrow's

---

### Utterance 12

**Say to ASR**: יש לי תור אצל התופרת מחר בשעה 10:32 ברחוב קוק 14 בהרצליה

**Expected raw ASR transcript (approximate)**: יש לי תור אצל התופרת מחר בשעה 10:32 ברחוב קוק 14 בהרצליה  
(ASR may produce "10.32" instead of "10:32" — cleanTranscript normalizes both forms.)

**Expected normalized transcript**: יש לי תור אצל התופרת מחר בשעה 10:32 ברחוב קוק 14 בהרצליה

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title: תור אצל התופרת (or "תור לתופרת")
- Date: מחר (2026-05-30)
- Time: 10:32
- Location extracted: רחוב קוק 14, הרצליה (visible in card or saved to event — note: ConfirmCard may not show location per privacy contract; verify location is saved to event data)

**Expected save behavior**: ALLOWED

**Expected due popup**: n/a

**Pass criteria**:
- Date is 2026-05-30
- Time is 10:32 (exact minutes preserved)
- "יש לי" does not appear in the title
- Location saved to event (verify in event detail after saving, if accessible)
- Save is allowed

**Common failure modes**:
- Time parsed as 10:00 (minutes dropped)
- ASR transcribes "10:32" as "עשר ושלושים ושתיים" (word form) and time parser misses it

---

### Utterance 13

**Say to ASR**: תזכירי לי בעוד חצי שעה לסגור את החלון

**Expected raw ASR transcript (approximate)**: תזכירי לי בעוד חצי שעה לסגור את החלון

**Expected normalized transcript**: תזכירי לי בעוד חצי שעה לסגור את החלון

**Expected route**: reminder → ReminderConfirmCard

**Expected ReminderConfirmCard content**:
- Title: לסגור את החלון
- Time label: בעוד 30 דקות
- Category: home

**Expected save behavior**: ALLOWED

**Expected due popup**: popup fires ~30 minutes after saving

**Pass criteria**:
- Route is reminder
- Title contains "לסגור את החלון"
- Time label is approximately 30 minutes from now
- "תזכירי" not in title
- Save allowed

**Common failure modes**:
- "חצי שעה" not parsed as 30 minutes (HEB_SPECIAL_MINUTES miss)
- Title includes "בעוד חצי שעה" as literal text instead of treating it as time

---

### Utterance 14

**Say to ASR**: תקבעי פגישה עם מור ביום שלישי בשמונה בבוקר

**Expected raw ASR transcript (approximate)**: תקבעי פגישה עם מור ביום שלישי בשמונה בבוקר

**Expected normalized transcript**: תקבעי פגישה עם מור ביום שלישי בשמונה בבוקר

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title: פגישה עם מור
- Date: יום שלישי, 2.6 (2026-06-02 — next Tuesday from Friday 2026-05-29)
- Time: 08:00 (period hint "בבוקר")
- Person: מור resolved (direct name lookup)

**Expected save behavior**: ALLOWED

**Expected due popup**: n/a

**Pass criteria**:
- Date is 2026-06-02 (not 2026-06-09 — must be the next occurrence of Tuesday, not the one after)
- Time is 08:00 (not 20:00)
- "תקבעי" not in title
- "מור" appears in title

**Common failure modes**:
- Date is wrong day-of-week resolution
- "תקבעי" leaks into title (ASR mishears as "תקווה" and strip fails)

---

### Utterance 15

**Say to ASR**: יש לי פגישה בשלוש

**Expected raw ASR transcript (approximate)**: יש לי פגישה בשלוש

**Expected normalized transcript**: יש לי פגישה בשלוש

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title: פגישה
- Date: missing or today (no date specified)
- Time: ambiguous — 03:00 or 15:00 (hour 3 falls in the 1–6 ambiguous range)
- Ambiguity UI shown: "לאיזו שעה התכוונת?" with two options (03:00 בלילה / 15:00 אחה"צ)

**Expected save behavior**: BLOCKED until tester picks AM or PM

**Expected due popup**: n/a (save blocked)

**Pass criteria**:
- Time is marked ambiguous (not silently defaulted to 03:00 or 15:00)
- Disambiguation UI shown with at least 2 options
- Save button hidden or disabled until user selects a time option
- Each option button ≥ 48px touch target

**Common failure modes**:
- Time defaulted to 15:00 without asking (over-eager PM inference)
- Save button shown as enabled despite ambiguous time
- Disambiguation UI missing or too small to tap

---

### Utterance 16

**Say to ASR**: תזכירי לי לקחת תרופה

**Expected raw ASR transcript (approximate)**: תזכירי לי לקחת תרופה

**Expected normalized transcript**: תזכירי לי לקחת תרופה

**Expected route**: reminder → ReminderConfirmCard

**Expected ReminderConfirmCard content**:
- Title: לקחת תרופה
- Date: missing
- Time: missing
- Missing fields UI shown: both date and time absent; disambiguation prompt offered (e.g., "מתי להזכיר לך?" with quick options)

**Expected save behavior**: BLOCKED — missing time + date

**Expected due popup**: n/a (save blocked)

**Pass criteria**:
- Route is reminder
- Title is "לקחת תרופה" (not empty)
- Save is blocked
- Card shows a clear Hebrew prompt asking when — not a raw error code
- Quick-pick options for time shown (e.g., "בעוד שעה", "היום בערב", "מחר בבוקר")

**Common failure modes**:
- Save allowed despite no time or date (should never happen)
- Title is empty ("תזכירי" stripped with nothing left)
- Disambiguation prompt not shown — blank card with disabled save

---

### Utterance 17

**Say to ASR**: מחר בשעה 2:34 יש לי תור אצל התופרת ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים

**Expected raw ASR transcript (approximate)**: מחר בשעה 2:34 יש לי תור אצל התופרת ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים

**Expected normalized transcript**: מחר בשעה 2:34 יש לי תור אצל התופרת ברחוב קוק 14 בהרצליה, יש לי חור במכנסיים

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title: תור אצל התופרת
- Date: מחר (2026-05-30)
- Time: 02:34 — AMBIGUOUS (hour 2 is in the 1–6 range; no period hint in the utterance)
- Notes: "חור במכנסיים" extracted (secondary "יש לי" clause)
- Location: רחוב קוק 14, הרצליה extracted

**Expected save behavior**: BLOCKED — time is ambiguous (02:34 or 14:34?)

**Expected due popup**: n/a (save blocked)

**Pass criteria**:
- Time shown as ambiguous — disambiguation UI with "02:34 בלילה" and "14:34 אחה"צ" options
- Notes field "חור במכנסיים" saved to event data (verify after save if accessible)
- Save blocked until time resolved
- Title does not contain "חור במכנסיים" (notes should not leak into title)

**Common failure modes**:
- Time defaulted to 14:34 without asking
- Notes extracted as part of title
- Second "יש לי" clause not detected

---

### Utterance 18

**Say to ASR**: תזכירי לי עוד רבע שעה לקחת ויטמינים

**Expected raw ASR transcript (approximate)**: תזכירי לי עוד רבע שעה לקחת ויטמינים

**Expected normalized transcript**: תזכירי לי עוד רבע שעה לקחת ויטמינים

**Expected route**: reminder → ReminderConfirmCard

**Expected ReminderConfirmCard content**:
- Title: לקחת ויטמינים
- Time label: בעוד 15 דקות
- Category: medication

**Expected save behavior**: ALLOWED

**Expected due popup**: popup fires ~15 minutes after saving

**Pass criteria**:
- Route is reminder
- Title: "לקחת ויטמינים"
- Time label references 15 minutes from now
- "תזכירי" not in title
- Save allowed

**Common failure modes**:
- "רבע שעה" not parsed as 15 minutes (HEB_SPECIAL_MINUTES miss for "עוד" without "בעוד" prefix)
- Title is empty or contains "עוד רבע שעה"

---

### Utterance 19

**Say to ASR**: יש לי תור לרופא ביום ראשון בשתיים בצהריים

**Expected raw ASR transcript (approximate)**: יש לי תור לרופא ביום ראשון בשתיים בצהריים

**Expected normalized transcript**: יש לי תור לרופא ביום ראשון בשתיים בצהריים

**Expected route**: appointment → ConfirmCard

**Expected ConfirmCard content**:
- Title: תור לרופא
- Date: יום ראשון, 31.5 (2026-05-31)
- Time: 14:00 (period hint "בצהריים")

**Expected save behavior**: ALLOWED

**Expected due popup**: n/a

**Pass criteria**:
- Date is 2026-05-31 (not 2026-06-07)
- Time is 14:00 (not 02:00)
- "יש לי" not in title
- Save allowed

**Common failure modes**:
- Same day-of-week resolution error as utterance 5 (different words, same logic)
- Period hint "בצהריים" not firing

---

### Utterance 20

**Say to ASR**: תוסיפי אירוע ביומן

**Expected raw ASR transcript (approximate)**: תוסיפי אירוע ביומן

**Expected normalized transcript**: תוסיפי אירוע ביומן

**Expected route**: appointment → ConfirmCard (STRONG_APPOINTMENT_VERBS does not match "תוסיפי"; WEAK + APPOINTMENT_NOUN_RE does match "אירוע")

**Expected ConfirmCard content**:
- All three fields missing: title, date, time
- All 3 missing fields stated clearly in Hebrew
- No save button enabled

**Expected save behavior**: BLOCKED — missing title, date, and time

**Expected due popup**: n/a

**Pass criteria**:
- Card shown (not silent fail)
- Card explicitly mentions all 3 missing fields in Hebrew
- Save button absent or disabled
- No raw English error codes visible
- Touch targets on clarification prompts (if any) ≥ 48px

**Common failure modes**:
- App silently does nothing (no card shown)
- Card shows partial fields with confusing partial state
- One or more missing fields not communicated

---

## 6. Failure Logging Format

Record every utterance in this table. One row per utterance. Copy the table into your test report.

| # | Said | ASR Output | Route | ConfirmCard Summary | Save Outcome | Notes | Pass/Fail |
|---|------|------------|-------|---------------------|--------------|-------|-----------|
| 1 | | | | | | | |
| 2 | | | | | | | |
| 3 | | | | | | | |
| 4 | | | | | | | |
| 5 | | | | | | | |
| 6 | | | | | | | |
| 7 | | | | | | | |
| 8 | | | | | | | |
| 9 | | | | | | | |
| 10 | | | | | | | |
| 11 | | | | | | | |
| 12 | | | | | | | |
| 13 | | | | | | | |
| 14 | | | | | | | |
| 15 | | | | | | | |
| 16 | | | | | | | |
| 17 | | | | | | | |
| 18 | | | | | | | |
| 19 | | | | | | | |
| 20 | | | | | | | |

**Column definitions**:

- **Said**: the exact Hebrew utterance spoken
- **ASR Output**: the transcript the app received from Whisper (copy from the UI if visible, or from network inspector)
- **Route**: `appointment` / `reminder` / `schedule_query` / `unknown`
- **ConfirmCard Summary**: title shown, date shown, time shown, person shown — brief
- **Save Outcome**: `allowed` / `blocked: <reason>` / `ambiguous: <what was asked>`
- **Notes**: any deviation from expected, crash details, rendering issues
- **Pass/Fail**: `PASS` / `FAIL` / `PARTIAL`

---

## 7. Pass/Fail Criteria

### Overall run status

| Status | Condition |
|--------|-----------|
| READY_FOR_RELEASE | 20/20 PASS |
| READY_WITH_KNOWN_ISSUES | 18–19 PASS, all failures are LOW severity and documented |
| NEEDS_FIX | Any FAIL on utterances 1, 3, 5, 6, 10, 15, 16, 20 (core routing and blocking logic) |
| BLOCKER | Any crash, data corruption, or silent save of an ambiguous event |

### Severity classification for failures

| Severity | Examples |
|----------|---------|
| BLOCKER | Crash; event saved without user confirmation; wrong person saved silently |
| HIGH | Wrong date by more than 1 day; wrong time by more than 1 hour; AM/PM flip without asking; schedule query routed as appointment |
| MEDIUM | Missing field not communicated; disambiguation UI too small; "תזכירי" leaks into title |
| LOW | Minor wording difference; secondary line color; notes not shown in card |

---

## 8. Known Limitations

The following are known at the time of this QA plan. They do not cause FAIL unless they violate the pass criteria above.

1. **ASR "תקבעי" → "תקווה" mishear** (W2, war room): Whisper may still transcribe "תקבעי" as "תקווה" on ambiguous audio. The verb-prior prompt mitigation in `calendarTranscribe.ts` biases the model but does not eliminate this risk. If it occurs in utterance 1, log the ASR output and mark FAIL with severity HIGH.

2. **Multi-person phrases not supported**: "עם הבעל של אופיר ועם מור" captures only the first person. Not tested in these 20 utterances.

3. **"ל"-prefixed bare names**: "להתקשר ללאו" (no "עם", no kinship word) is not resolved. Utterance 8 uses the kinship form which is supported.

4. **Birth-order descriptors**: "הבת הגדולה של מור" falls through to `missing` — not an error, by design.

5. **Sibling resolution (utterance 2)**: אחות של ארי may resolve, be ambiguous, or be missing depending on the family graph data. Any of these three statuses is acceptable; what is NOT acceptable is a crash or an invented name.

6. **"בערב" time resolution (utterance 8)**: The reminder parser may not resolve "בערב" alone to a specific hour. If save is blocked with a clear Hebrew reason, this is a PARTIAL, not a FAIL.

7. **Location not visible in ConfirmCard**: Per the privacy contract, ConfirmCard does not display location. Location is saved to the event data but not shown in the confirmation. Tester should verify by opening the saved event detail screen.

8. **Popup timing for utterances 3, 13, 18**: The due popup for short-interval reminders should fire within ±1 minute of the stated delay. If the device goes to sleep, the notification may be delayed by the OS — this is a device limitation, not a pipeline failure.
