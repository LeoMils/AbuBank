# LOCAL BROWSER QA RESULTS

## Environment
- Branch: `feat/calendar-revolution`
- HEAD: `5339d69` (starting) + local fixes
- Dev server: `http://127.0.0.1:5173/` (confirmed 200)
- Date: 2026-06-01
- Test harness: `voicePipelineGolden.test.ts` — runs identical pipeline code to browser

## Method
No browser automation (Playwright/Cypress) available. Tests run via the deterministic
`voicePipelineHarness.ts` which exercises the same code path as the live browser:
`cleanTranscript` → intent detection → `parseReminder`/`parseLocally` → `resolvePersonPhrase` → save gate.

The harness does NOT cover:
- Mic recording → blob → STT → transcript (hardware + API)
- React rendering → visual layout (CSS/DOM)
- TTS interference with recording

Those layers require manual device testing (see NEEDS_BROWSER_QA items below).

## 30-Scenario Results

| # | Utterance | Route | Date | Time | Person | Save | Result |
|---|-----------|-------|------|------|--------|------|--------|
| 1 | מחר בחצות פגישה עם אופיר | appointment_create | tomorrow | 00:00 | אופיר | yes | PASS |
| 2 | מחר בחצות וחצי פגישה עם אופיר | appointment_create | tomorrow | 00:30 | אופיר | yes | PASS |
| 3 | מחר רבע לחצות פגישה עם אופיר | appointment_create | tomorrow | 23:45 | אופיר | yes | PASS |
| 4 | מחר רבע אחרי חצות פגישה עם אופיר | appointment_create | tomorrow | 00:15 | אופיר | yes | PASS |
| 5 | מחר בתשע וחצי בערב פגישה עם אופיר | appointment_create | tomorrow | 21:30 | אופיר | yes | PASS |
| 6 | תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר | appointment_create | tomorrow | 21:00 | גלעד (resolved) | yes | PASS |
| 7 | תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי | appointment_create | tomorrow | 21:30 | אחות של ארי (honest) | blocked | PASS |
| 8 | מחר בחמש אחר הצהריים פגישה עם הגרוש של מור | appointment_create | tomorrow | 17:00 | רפי (resolved) | yes | PASS |
| 9 | מחר בשמונה בבוקר אני רוצה להיפגש עם אבא של אנאבל | appointment_create | tomorrow | 08:00 | ambiguous (Ofir/Gilad) | blocked | PASS |
| 10 | תזכירי לי בעוד שתי דקות לקחת כדור | reminder_create | +2 min | dueAt | — | yes | PASS |
| 11 | תזכירי לי בעוד שעה וחצי לבדוק כביסה | reminder_create | +90 min | dueAt | — | yes | PASS |
| 12 | תזכירי לי בעוד שעה ועשרים דקות להתקשר למשה | reminder_create | +80 min | dueAt | — | yes | PASS |
| 13 | תזכירי לי בעוד 25 דקות לשתות מים | reminder_create | +25 min | dueAt | — | yes | PASS |
| 14 | בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה | reminder_create | +2 min | dueAt | — | yes | PASS |
| 15 | היום בחצות תזכירי לי לבדוק דלת | reminder_create | today | 00:00 | — | depends | PASS |
| 16 | בחצות וחצי תזכירי לי לקחת כדור | reminder_create | — | 00:30 | — | depends | PASS |
| 17 | כל יום בתשע בבוקר לקחת תרופה | reminder_create | recurring | 09:00 | — | yes | PASS |
| 18 | תזכירי לי להתקשר לבעל של אופיר בערב | reminder_create | — | — | גלעד (resolved) | blocked (time) | PASS |
| 19 | תזכירי לי להתקשר לחברה של מור בערב | reminder_create | — | — | missing (friend) | blocked | PASS |
| 20 | מי הבעל של אופיר | family_query | — | — | — | no | PASS |
| 21 | מי אחות של ארי | family_query | — | — | — | no | PASS |
| 22 | מה התוכניות שלי השבוע | calendar_query | — | — | — | no | PASS |
| 23 | מה יש לי מחר | calendar_query | — | — | — | no | PASS |
| 24 | יש לי תור לרופא מחר בעשר בבוקר | appointment_create | tomorrow | 10:00 | — | yes | PASS |
| 25 | תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים | appointment_create | Sunday | 14:00 | — | yes | PASS |
| 26 | קבעי לי פגישה | appointment_create | — | — | — | blocked | PASS |
| 27 | תזכירי לי לקחת כדור | reminder_create | — | — | — | blocked (time) | PASS |
| 28 | מחר בתשע פגישה עם אופיר | appointment_create | tomorrow | 09:00 | אופיר | yes | PASS |
| 29 | ביטול | unknown | — | — | — | no | PASS |
| 30 | כן | unknown | — | — | — | no | PASS |

## Summary
- **Total**: 30
- **Pass**: 30
- **Fail**: 0
- **Blocked correctly**: 7 (ambiguous time, missing fields, ambiguous person — all by design)

## Notes
- RC-28: "מחר בתשע" resolves to 09:00 (not ambiguous). Hours 7-11 default to morning per product policy. This is known behavior.
- RC-9: Required adding "להיפגש עם" to APPOINTMENT_CONTENT — natural Martita phrasing was unrecognized.
- RC-7: "אחות של ארי" — Ari's sibling (Anabel) is correctly found via the sibling resolution path.

## NEEDS_BROWSER_QA (not testable by harness)
1. Mic recording → actual blob quality on Galaxy S25 Edge
2. Silence cutoff timing — does it cut too early for slow speakers?
3. TTS playback from previous answer overlapping new recording
4. ConfirmCard layout on 360x740 viewport
5. QA panel toggle + display
