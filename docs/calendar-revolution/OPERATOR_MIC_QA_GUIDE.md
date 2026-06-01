# OPERATOR MIC QA GUIDE

## What You Need
- Phone or tablet with browser (Chrome recommended)
- Dev server running at http://127.0.0.1:5173/ (or deployed preview)
- Quiet room (less background noise = better)

## Steps

### 1. Open AbuCalendar
Open the app and navigate to the Calendar screen.

### 2. Enable QA Mode
At the bottom center of the screen, find the button labeled **QA OFF**.
Tap it. It should change to **QA ON** (gold color).

Two panels will appear:
- **MIC QA TRACE** (bottom-left) — shows last voice result
- **QA RECORDER** (bottom-right) — shows run count + buttons

### 3. Clear Previous Runs
On the **QA RECORDER** panel, tap **Clear**.
The count should show (0).

### 4. Speak Each Phrase
For each of the 30 phrases below:
1. Tap the microphone button (red circle)
2. Say the phrase clearly, at normal speed
3. Wait for auto-stop (silence detection) OR tap stop manually
4. Look at the **MIC QA TRACE** panel — check route/time/person/saveAllowed
5. Look at the confirmation card — does it match what you said?
6. If correct: tap **PASS** on the QA RECORDER panel
7. If wrong: tap **FAIL** on the QA RECORDER panel
8. Tap Cancel/ביטול on the confirmation card to clear it

### 5. Copy Results
After all 30 phrases, tap **Copy All JSON** on the QA RECORDER panel.
Paste it into a message and send it back for analysis.

## 30 Test Phrases

| # | Say This | Expected Result |
|---|----------|----------------|
| 1 | מחר בחצות פגישה עם אופיר | appointment, 00:00, save yes |
| 2 | מחר בחצות וחצי פגישה עם אופיר | appointment, 00:30, save yes |
| 3 | מחר רבע לחצות פגישה עם אופיר | appointment, 23:45, save yes |
| 4 | מחר רבע אחרי חצות פגישה עם אופיר | appointment, 00:15, save yes |
| 5 | תקבעי לי פגישה למחר בשעה 21 עם הבעל של אופיר | appointment, 21:00, גלעד, save yes |
| 6 | תקבע לי פגישה מחר בתשע וחצי בערב עם אחות של ארי | appointment, 21:30, relation shown |
| 7 | מחר בחמש אחר הצהריים פגישה עם הגרוש של מור | appointment, 17:00, רפי, save yes |
| 8 | מחר בשמונה בבוקר אני רוצה להיפגש עם אבא של אנאבל | appointment, 08:00, ambiguous, save blocked |
| 9 | מחר בתשע וחצי בערב פגישה עם אופיר | appointment, 21:30, save yes |
| 10 | תזכירי לי בעוד שתי דקות לקחת כדור | reminder, +2 min, save yes |
| 11 | בעוד עשר דקות סליחה בעוד שתי דקות להתקשר למשה | reminder, +2 min (correction), save yes |
| 12 | תזכירי לי בעוד שעה ועשרים דקות להתקשר למשה | reminder, +80 min, save yes |
| 13 | תזכירי לי בעוד 25 דקות לשתות מים | reminder, +25 min, save yes |
| 14 | בחצות וחצי תזכירי לי לקחת כדור | reminder, 00:30 |
| 15 | יש לי תור לרופא מחר בעשר בבוקר | appointment, 10:00, save yes |
| 16 | תזכירי לי בעוד שעה וחצי לבדוק כביסה | reminder, +90 min, save yes |
| 17 | כל יום בתשע בבוקר לקחת תרופה | reminder, recurring daily |
| 18 | תזכירי לי להתקשר לבעל של אופיר בערב | reminder, גלעד resolved |
| 19 | תזכירי לי להתקשר לחברה של מור בערב | reminder, friend missing (honest) |
| 20 | מי הבעל של אופיר | family query, no save |
| 21 | מי אחות של ארי | family query, no save |
| 22 | מה התוכניות שלי השבוע | schedule query, no save |
| 23 | מה יש לי מחר | schedule query, no save |
| 24 | תוסיפי תור לתופרת ביום ראשון בשתיים בצהריים | appointment, Sunday, 14:00, save yes |
| 25 | היום בחצות תזכירי לי לבדוק דלת | reminder, today, 00:00 |
| 26 | קבעי לי פגישה | appointment, blocked (missing fields) |
| 27 | תזכירי לי לקחת כדור | reminder, blocked (missing time) |
| 28 | מחר בתשע פגישה עם אופיר | appointment, 09:00, save yes |
| 29 | ביטול | unknown, no save |
| 30 | כן | unknown, no save |

## What to Look For

For each phrase:
- **route**: Does the QA trace show the right type? (appointment_create / reminder_create / family_query / calendar_query / unknown)
- **time**: Is the time correct?
- **person**: Is the right person resolved? Or honestly "missing"?
- **saveAllowed**: Can you save when expected? Blocked when expected?
- **card**: Does the confirmation card make sense?
- **words**: Did Whisper capture all the words you said? (Check "raw" line in QA trace)

## Troubleshooting

- **QA OFF button not visible**: Only shows in dev mode (not production builds)
- **No transcript after speaking**: Check that mic permission is allowed in browser
- **Very short recording**: Silence detection may stop too early. Speak within 1.5 seconds of pressing record.
- **Copy button doesn't work**: Try long-press → paste method if clipboard is blocked
