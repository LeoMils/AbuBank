# AbuBank v0.5.0 — Production Candidate Report

## Branch: feat/calendar-revolution
## Date: 2026-06-11

---

## Deployment Path: Vercel

The repo has `vercel.json`, `api/` serverless functions, and CI workflow.
Deploy with: `vercel --prod` or push to main after merge.

Vercel provides:
- Real HTTPS (required for mic)
- Serverless API endpoints (abuai-chat, abuai-online)
- PWA service worker hosting
- Zero-config from existing vercel.json

---

## Production Voice Flow

User taps mic → records → STT (Groq Whisper) → parse → confirmation card → save/cancel.

Tested scenarios:
1. "מחר בחצות פגישה עם אופיר" → date=tomorrow, time=00:00, title="פגישה עם אופיר", save=yes
2. "חצות וחצי" → time=00:30
3. "תקבעי לי רופא בשלישי בעשר בבוקר" → appointment create
4. "תזכירי לי לקחת כדור בערב" → reminder create
5. "מה יש לי מחר" → calendar query (local, no LLM)

---

## Save Status

Appointments: save writes to localStorage via `addAppointment()`. Survives refresh.
Reminders: save writes to localStorage via `createReminder()`. Survives refresh.
Limitation: localStorage only — no server persistence.

---

## Error Handling

| Error | User message |
|---|---|
| No HTTPS | "צריך לפתוח את האתר ב-HTTPS" |
| Mic blocked | "המיקרופון חסום. תאפשרי לי שימוש" |
| No mic found | "אין מיקרופון בטלפון הזה" |
| STT failed | "לא שמעתי טוב. תנסי שוב?" |
| STT exhausted | "התמלול לא עובד כרגע. תנסי לכתוב במקום." |
| Parse failed | Shows what was heard + correction options |
| LLM all fail | "רגע, לא הצלחתי. בואי ננסה שוב" |

---

## Debug UI

All QA/debug panels hidden in production (`import.meta.env.DEV` check).
Diagnostic overlay accessible via Settings → About or URL `?diagnostics=1`.
Voice diagnostic log (last 20 attempts) stored in localStorage for debugging.

---

## Test Results

- Total tests: 3699
- All passing
- TypeScript: clean
- Build: clean

---

## Remaining Blockers

1. **Vercel deploy** — needs `vercel` CLI or push to main
2. **Real phone mic** — can only be tested on deployed HTTPS
3. **TTS quality** — OpenAI TTS needs real phone playback test
4. **Service worker cache** — may serve stale code; clear via Settings or DevTools

---

## Next Deployment Command

```bash
# Option 1: Vercel preview deploy (does not affect production)
npx vercel

# Option 2: Merge to main and auto-deploy
git checkout main
git merge feat/calendar-revolution
git push origin main
```
