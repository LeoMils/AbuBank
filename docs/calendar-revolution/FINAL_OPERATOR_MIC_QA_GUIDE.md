# FINAL OPERATOR MIC QA GUIDE

## 11 Steps — No DevTools, No Console

### 1. Start local server
On the computer, run: `npm run dev -- --host 0.0.0.0 --port 5173`

### 2. Open phone URL
On the phone browser (Chrome), go to: `http://<computer-ip>:5173/`

### 3. Open AbuCalendar
Navigate to the Calendar screen.

### 4. Tap QA OFF → QA ON
Bottom center of screen. Button changes to gold "QA ON".
Three panels appear: MIC QA TRACE (left), QA RECORDER (right), "Start Guided QA" (top-right).

### 5. Tap Clear QA Log
On the QA RECORDER panel (bottom-right), tap **Clear**. Count shows (0).

### 6. Tap "Start Guided QA"
Top-right button. A gold banner appears at the top showing:
- Phrase number (1/30)
- Phrase ID (rc-01)
- The phrase to speak in large Hebrew text

### 7. Speak the shown phrase
- Tap the microphone button (red circle)
- Say the phrase clearly, at normal speed
- Wait for auto-stop ("הבנתי, בודקת...") or tap stop manually

### 8. Mark PASS or FAIL
Look at the MIC QA TRACE panel — check route/time/person/saveAllowed.
Look at the confirmation card.
- If everything correct → tap **PASS** on QA RECORDER
- If anything wrong → tap **FAIL** on QA RECORDER
- Then tap Cancel/ביטול on the confirmation card

### 9. Tap Next →
On the guided QA banner, tap **Next →** to move to the next phrase.

### 10. Repeat for all 30 phrases
When you reach 30/30 and finish, the banner shows "!סיימנו".

### 11. Copy All QA JSON
On the QA RECORDER panel, tap **Copy All JSON**.
Paste the JSON into a message and send it back.

## What the JSON Contains (per run)
- expectedId + expectedUtterance (which phrase was being tested)
- rawTranscript + normalizedTranscript (what Whisper heard)
- semanticRoute, time, date, person, saveAllowed
- audioDurationMs, blobSize, chunksCount, stopReason, sttStatus
- comparisonResult: pass/fail (your mark)

## Quick Troubleshooting
- **No QA panels**: Make sure QA is ON (gold button)
- **No transcript**: Allow mic permission in browser settings
- **"Start Guided QA" not visible**: QA must be ON first
- **Copy doesn't work**: Try selecting all text in the prompt dialog
