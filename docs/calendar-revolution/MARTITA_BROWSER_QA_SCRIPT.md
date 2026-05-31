# Martita Browser QA Script — Universe-War Mode

20-step live mic QA script for `feat/calendar-revolution` HEAD.
Run after `npm run dev` in a real browser on a 360×740 mobile viewport.

## Pre-flight

1. Confirm the dev badge in the bottom-left reads
   `v{APP_VERSION.version} · local build`. If you see
   `VOICE_RESET_ACTIVE_*` anywhere — **STOP**, the build is stale.
2. Tap the small "QA" button in the bottom-right corner. It should turn
   on (filled gold). The mic-QA trace panel should appear above it
   showing the placeholder dashes for raw / norm / route / date / time /
   person.
3. Tap "QA" again to confirm it turns off and the panel disappears.
4. Turn QA back on for all of the following tests.

## Capture format

For each utterance, record:
- **raw** — string in the mic-qa-raw row
- **norm** — string in the mic-qa-normalized row
- **route** — `appointment` / `reminder` / `schedule_query` / `family_query` / `unknown`
- **card** — which confirmation card appeared
- **date / time / person** — exact values shown on the card
- **save** — did `כן, לשמור` work and was the saved item visible afterwards
- **verdict** — PASS / FAIL with one-line reason

---

## 20 Live Tests

### #1 — "מחר בחצות פגישה עם אופיר"
- Expected route: `appointment`
- Expected date: tomorrow (YYYY-MM-DD shown as label "מחר")
- Expected time: `00:00`
- Expected card: complete appointment ConfirmCard with `פגישה עם אופיר`
- Save: allowed; saved event appears in the next day's view.

### #2 — "היום בחצות תזכירי לי לבדוק דלת"
- Expected route: `reminder`
- Expected time: `00:00`
- Expected card: ReminderConfirmCard with title `לבדוק דלת`
- Save: allowed.

### #3 — "תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר"
- Expected route: `appointment`
- Expected date: tomorrow, time: `21:00`
- Expected card: shows `פגישה עם גלעד` with secondary line `הבעל של אופיר`
  (resolved kinship).
- Save: allowed.

### #4 — "תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי"
- Expected route: `appointment`, time: `21:30`
- Expected card: must extract the phrase `אחות של ארי` AND show one of:
  resolved (with a real sister name), ambiguous (chips), or missing
  ("לא מצאתי בוודאות מי") — never silently invent.

### #5 — "תזכירי לי בעוד שתי דקות לקחת כדור"
- Expected route: `reminder`
- Expected date label: `בעוד 2 דקות`
- Expected card title: `לקחת כדור`
- Save: allowed. Wait 2 minutes with tab open — due popup MUST fire.

### #6 — "בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה"
- Self-correction: the normalized transcript must NOT contain "סליחה"
  and must NOT contain "עשר דקות". Final time: `בעוד 2 דקות`.

### #7 — "תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים"
- Expected route: `appointment`
- Expected date: next Sunday (resolve based on today)
- Expected time: `14:00`
- Save: allowed.

### #8 — "מה התוכניות שלי השבוע"
- Expected route: `schedule_query`
- Expected behaviour: AbuAI reads back the week's events. No save card.

### #9 — "מי הבעל של אופיר"
- Expected route: `family_query`
- Expected behaviour: AbuAI answers `גלעד`. No save card.

### #10 — "תזכירי לי להתקשר לחברה של מור בערב"
- Expected route: `reminder`
- Expected relation status: missing — card must say
  `לא מצאתי בוודאות מי` followed by the phrase.
- Save: must offer `לשמור כך` / `לתקן` / `ביטול` and not block save.

### #11 — "מחר בתשע פגישה עם אופיר"
- AM/PM is ambiguous (hour 9). Expect ambiguity flow asking
  בבוקר / בערב, OR the card surfaces the resolution UI before save.

### #12 — "מחר בתשע בערב פגישה עם אופיר"
- Same as #11 but disambiguated. Expected time: `21:00`. Save allowed.

### #13 — "תזכירי לי לקחת כדור"
- No time, no date. Expected card: missing-time ReminderConfirmCard with
  four suggestion buttons. Tapping `לבחור שעה` must NOT crash and must
  open the manual edit fields with a visible save path.

### #14 — "תזכירי לי מחר לקחת כדור"
- Date `מחר` but no time. Expected card: missing-time variant; date is
  pre-filled to tomorrow.

### #15 — "קבעי לי פגישה"
- No title, no date, no time. Expected: prompt/correction card. Must not
  silently save an empty appointment.

### #16 — "יש לי תור לרופא מחר בעשר"
- Hour 10 is ambiguous (AM/PM). Expect AM/PM ambiguity resolver OR a
  bare 10:00 with the period chooser exposed before save.

### #17 — "מחר בערב פגישה עם אופיר"
- Time bucket only ("בערב"). Acceptable behaviour:
  - card surfaces missing-time and offers suggestion chips, OR
  - card uses a stable evening default (document which).

### #18 — "תזכירי לי בעוד שעה וחצי לבדוק כביסה"
- Expected route: `reminder`
- Expected date label: `בעוד 90 דקות` or similar.
- Save: allowed.

### #19 — "מי אחות של ארי"
- Expected route: `family_query`. AbuAI either answers with the resolved
  sister name OR honestly says it does not know.

### #20 — "תזכירי לי להתקשר לבעל של אופיר בערב"
- Expected route: `reminder`
- Person resolves to `גלעד` (regression guard).
- Time: bucket only ("בערב"); expect missing-time flow OR evening default.

---

## Stop conditions

Stop the QA pass and file a blocker if any of these occur:
- `VOICE_RESET_ACTIVE_*` appears anywhere visible.
- Mic recording does not stop on second tap.
- Save button is unreachable on a complete draft.
- Any unresolved family phrase is silently saved as a real person.
- An "Invalid Date" string appears in any card.
- AbuAI claims it checked the calendar/web/family and the
  mic-qa-trace `route` proves no such tool ran.

## Exit criteria

20/20 PASS → upgrade verdict in `UNIVERSE_WAR_FINAL_REPORT.md` from
`READY_FOR_BROWSER_MIC_QA` to `PARTIAL_READY_FOR_MARTITA` (still requires
F-7 background reliability work before unsupervised release).

Any FAIL → write the case in `LIVE_FAILURE_REGISTER.md` with severity,
layer, and the mic-qa-trace values before further changes.
