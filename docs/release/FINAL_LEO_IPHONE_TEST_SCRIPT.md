# FINAL LEO iPHONE TEST SCRIPT

**Build:** `0.52.0-final-iphone-gate` · Preview URL in the chat report.
Leo does not debug — open, talk, tap Copy, paste back.

## 1. Open the preview on iPhone Safari
Open the preview URL → tap **AbuAI**.

## 2. Confirm the build
In the AbuAI footer, the **PRODUCT TRUTH** panel must show
`BUILD_ID: 0.52.0-final-iphone-gate`. If it shows an older build, hard-refresh
(pull down) and reopen.

## 3. Talk (Realtime) — say each line, one at a time
```
שלום
מי זאת מור?
ספרי לי עליה
תקבעי לי פגישה
עם מור
מחר בשמונה
בקפה אסתר בנהריה
כן
מתי הפגישה עם מור?
באיזה שעה?
איפה?
די
איזה משחקים יש מחר?
ומי משחק ראשון?
מה דיברנו קודם?
Hola, contame quién es Mor
¿Qué tengo mañana?
ביי
```
What to listen for as you go:
- "מי זאת מור?" → warm, correct; "ספרי לי עליה" stays on **Mor** (not a cold guess).
- "תקבעי לי" → she asks what/when; the slots ("עם מור", "מחר בשמונה", "בקפה אסתר
  בנהריה") build ONE meeting; "כן" **saves it with the location**.
- "מתי הפגישה עם מור?" → the meeting (not a birthday). "באיזה שעה?/איפה?" answer
  **from that meeting** (time + Nahariya café), never "which day?".
- "די" → cleanly drops whatever was open; the next line is **not** hijacked.
- "איזה משחקים…" → live/online; "ומי משחק ראשון?" stays on the games (not calendar).
- "מה דיברנו קודם?" → a real topic, never "we talked about 'never mind'".
- Spanish lines → natural Spanish, correct about Mor, tomorrow's calendar.

## 4. Copy the report
Exit voice → in the AbuAI footer tap **📋 Copy Product Truth Report** → paste it
back to Leo's chat.

## 5. PASS / FAIL
**PASS** — all true:
- no forced menu ("פגישה, יומן, משפחה?") anywhere
- no context loss (follow-ups stayed on topic)
- online never became a reminder/calendar answer
- the meeting search returned the **meeting**, not a birthday
- the saved meeting kept the **Nahariya café** location
- Spanish sounded natural
- the report shows `VOICE_MODE: realtime`, `FALLBACK_USED: NO` (or, if it fell
  back, it says so honestly — that's still a valid paste)
- the Product Truth report copied

**FAIL** — any of:
- a wrong route, a forced menu, robotic voice, context loss
- a missing location, a birthday instead of the meeting
- the fallback was used but hidden
- the Product Truth report is missing fields

If FAIL: the report's `LAST_ERROR` / `FALLBACK_USED` / `ROUTE` lines say exactly
what happened — paste it and it gets fixed with zero guessing.

## Device HOLD (expected, not a failure)
Physical mic sensitivity, STT accuracy, TTS voice *feel*, and the WebRTC audio
handshake are device-only. The ephemeral Realtime token mints server-side
(`ok=true`); only this on-device run can clear the audio feel.
