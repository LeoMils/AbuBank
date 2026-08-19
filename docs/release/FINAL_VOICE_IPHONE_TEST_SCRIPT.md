# FINAL VOICE iPHONE TEST SCRIPT

**Build:** `0.54.0-voice-text-brain-unification` · Preview URL in the chat report.
The point of this test: the MICROPHONE now uses the exact same AbuAI brain as typed
text. Every spoken turn is transcribed, routed through `ExecutiveCognitive
Controller`, and only then voiced.

## 1. Open the preview on iPhone Safari → AbuAI
Confirm the **PRODUCT TRUTH** panel shows `BUILD_ID: 0.54.0-voice-text-brain-unification`.

## 2. Press the mic and speak, one line at a time
```
שלום
מי זאת ירדן?
מי זה עילי?
מי זאת מור?
ספרי לי עליה
תקבעי לי פגישה עם מור מחר בשמונה בקפה אסתר בנהריה ותכתבי שנדבר על הפרויקט
כן
מה קבענו?
באיזה שעה?
איפה?
איזה משחקים יש מחר?
ומי משחק ראשון?
מה מזג האוויר בכפר סבא?
מה דיברנו קודם?
```
Now test **barge-in**: while AbuAI is answering, cut in and say:
```
רגע, מי זאת אופיר?
```
Then:
```
ביי
```

## 3. What to watch as you go
- **Every spoken sentence appears in the dialog** as your text (transcript visible).
- Family (ירדן / עילי / מור / אופיר) → correct person, correct gender, grounded —
  not the model guessing.
- The long calendar sentence → a card with **Mor / tomorrow / time / קפה אסתר בנהריה /
  the project note** (location + notes retained, not a raw-transcript title).
- "מה קבענו? / באיזה שעה? / איפה?" → answered **from that meeting**.
- "איזה משחקים / ומי משחק ראשון / מזג האוויר" → live/online, never a reminder/calendar.
- "מה דיברנו קודם?" → a real topic, never "we talked about 'never mind'".
- Barge-in → AbuAI stops and answers the new question.

## 4. Copy the report
Exit voice → tap **📋 Copy Product Truth Report** → paste it back. It must show, for
the last spoken turn:
`INPUT_SOURCE: voice_realtime` · `BRAIN_PIPELINE_USED: YES` ·
`EXECUTIVE_CONTROLLER_USED: YES` · `RAW_TRANSCRIPT` · `ROUTE` · `TOOL_USED` ·
`VAD_TYPE: semantic_vad` · `BARGE_IN_ENABLED: YES` · `FALLBACK_USED: NO` (or an
honest fallback line if Realtime was unavailable).

## 5. PASS
- transcript visible for every spoken turn
- same intelligence as typed text (family/calendar/online/memory all work by voice)
- calendar fields (location/notes) retained
- barge-in works OR the report clearly says it's not active
- `BRAIN_PIPELINE_USED: YES`
- no hidden fallback

## 6. FAIL (and the report tells us exactly why)
- a spoken turn produced an action with no visible user text
- online/calendar/family works in text but fails by voice
- `BRAIN_PIPELINE_USED: NO` (voice bypassed the brain)
- missing location/notes on the saved meeting
- forced menu, robotic voice, or a hidden fallback
- Product Truth report incomplete

## Device HOLD (expected)
Physical mic sensitivity, STT accuracy, TTS voice *feel*, and the live WebRTC audio
handshake are device-only. The ephemeral Realtime token mints server-side
(`ok=true`); only this on-device run can clear the audio feel.
