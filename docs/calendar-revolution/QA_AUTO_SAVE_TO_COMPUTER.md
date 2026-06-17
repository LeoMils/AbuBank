# QA Auto-Save to Computer

## No More Mobile Clipboard

QA runs are now automatically saved to the computer running the Vite dev server.
No Copy/Paste needed. No clipboard issues on iPhone Safari.

## How It Works

1. Phone browser POSTs QA data to `/__abu_calendar_qa_log` on the Vite server
2. Vite middleware writes the data to:
   - `tmp/abu-calendar-qa/latest.json` (always overwritten)
   - `tmp/abu-calendar-qa/run-YYYY-MM-DDTHH-MM-SS.json` (timestamped archive)
3. Every `appendQaRun()` call auto-uploads (non-blocking)
4. Status shown in QA panels: "נשמר למחשב" or "שמירה נכשלה"

## Operator Flow

1. On computer: `npm run dev -- --host 0.0.0.0 --port 5173`
2. On phone: open `http://<computer-ip>:5173/`
3. AbuCalendar → QA OFF → QA ON
4. Start Guided QA → speak each phrase → PASS/FAIL → Next
5. **Do not copy anything.** Runs save automatically.
6. After all 30 phrases, on the **computer** open:
   ```
   tmp/abu-calendar-qa/latest.json
   ```
7. That file contains all QA runs with expected vs actual data.

## Manual Save Button

If auto-save fails (network issue), use:
- "שמור למחשב" button in QA Recorder panel
- "שמור עכשיו למחשב" button at end of Guided QA

## File Location

```
C:\Users\Lmilstein\ClaudeCode\Abu-Bank\
  tmp\
    abu-calendar-qa\
      latest.json          ← always the most recent full export
      run-2026-06-01T15-30-00.json  ← timestamped archive
```

## Fallback

Copy JSON button still works as a secondary option if needed.
