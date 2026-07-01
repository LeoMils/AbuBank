# AbuAI — Final Human Acceptance Test (Leo, on the iPhone PWA)

Open the newest deployment (`/api/health` shows `buildVersion`). Tap voice, allow
mic. For each line: say it, check expected behavior, score 0–5 on **Warmth /
Clarity / Usefulness / Adult-tone / Memory-Calendar-correctness**. Note anything a
subjective human must judge (marked **HUMAN**) and anything physical (marked **DEVICE**).
Pass criteria are per-row. Overall PASS = 0 red rows + avg ≥ 4.0.

| # | Category | User says | Expected AbuAI behavior | Pass / Fail criteria | DEVICE/HUMAN check |
|---|---|---|---|---|---|
| 1 | Greeting | (open voice) | "ערב טוב, Martita. אני איתך." — warm, short, no menu | no "אפשר לדבר איתי…" list | HUMAN warmth; DEVICE voice sounds natural |
| 2 | Hebrew calendar | "תקבעי פגישה עם מור מחר בשלוש" | draft: מור / tomorrow / 15:00; asks confirm | not 03:00; clean title | HUMAN clarity |
| 3 | Confirm | "כן" | saves; reads back who/date/time | event saved + readback | — |
| 4 | Calendar 3:00 trap | "פגישה להיום בשעה 3:00 עם גבי" | 15:00 (or asks "שלוש אחר הצהריים?") | never 03:00 | — |
| 5 | Location follow-up | "בבית קפה מרוקו" | merges location into pending event | not cancelled | — |
| 6 | Confirm phrase | "מאושר" | saves | saved | — |
| 7 | Cancel | "בטלי" | cancels warmly | draft cleared | — |
| 8 | Spanish calendar | "agendá una reunión con Gabi mañana a las tres" | draft Gabi/tomorrow/15:00 | works in Spanish | HUMAN es phrasing |
| 9 | Spanish confirm | "dale" | saves | saved | — |
| 10 | Spanish location | "en el café Morocco" | merges location | not cancelled | — |
| 11 | Calendar read | "מה יש לי מחר" | reads tomorrow's events concisely | correct events | — |
| 12 | Family | "מי זאת מור" | daughter; correct relationship | matches family_data | — |
| 13 | Family birthday | "מתי יום ההולדת של מור" | correct date from data | correct/says unknown | — |
| 14 | Family Spanish | "quién es Ofir" | correct family answer | correct | HUMAN es tone |
| 15 | Memory continue | ask World-Cup results → then "תמשיכי" | resumes the cached answer | does NOT restart/forget | — |
| 16 | Why / repair | after an online fail: "למה" | states the real reason + retry | not a generic refusal loop | — |
| 17 | Online challenge | "יש לך אונליין" | acknowledges + explains + offers retry | no loop | — |
| 18 | Emotional grief | "אני מתגעגעת לפאפי" | warm, present, not therapy-bot | no menu/tips-dump | HUMAN depth |
| 19 | Emotional lonely | "אני לבד היום" | listens, warm, one gentle move | not "how can I help" | HUMAN depth |
| 20 | Emotional Spanish | "estoy sola" | warm Spanish ("Estoy con vos.") | NOT Hebrew | HUMAN es warmth |
| 21 | Weather | "מה מזג האוויר בכפר סבא עכשיו" | short spoken summary, Celsius | no URL/markdown/Fahrenheit | — |
| 22 | Weather challenge | "השעה שאמרת לא נכונה" | acknowledges honestly | no defensive loop | HUMAN |
| 23 | Online sports (name trap) | "מי ניצח בין ארגנטינה לירדן" | routes online (ירדן=Jordan, not family) | not treated as family | — |
| 24 | Tomorrow games | "איזה משחקים יש מחר" | fresh online schedule | not a repeat of prior | — |
| 25 | Reminder | "תזכירי לי לקחת כדור בשמונה בערב" | reminder draft → confirm | saved as reminder | — |
| 26 | Pending pollution | (mid calendar draft) "כמה יצא הכדורגל" | parks calendar, answers sports | not a calendar confirmation | — |
| 27 | Repeated question | ask the same thing twice | consistent, not annoyed/looping | same correct answer, warm | HUMAN |
| 28 | Confusion recovery | "לא הבנת אותי" | "רגע, למה התכוונת?" — warm re-ask | not defensive | HUMAN |
| 29 | Mixed he/es | "tengo una cita עם מור mañana" | best-effort parse or graceful ask | no dead-end | HUMAN |
| 30 | Provider fail (offline) | (airplane mode) "מה השעה בלונדון" | honest "אין לי חיבור…" in her language | localized + actionable | DEVICE offline |

## Scoring sheet (fill per row)
`#, warmth, clarity, usefulness, adult-tone, correctness, notes`

## What Leo MUST check on device (cannot be proven in code)
- Voice **sound**: warm/natural, not robotic/slow/drunk (rows 1,18–20).
- Mic capture reliability + STT accuracy in Hebrew and Spanish.
- TTS actually plays after every answer (no text-only).
- Latency: local answer starts speaking < 3 s after transcript; online < 7 s or honest fallback.
- Realtime: currently DOWN → app must fall back silently to pipeline (no error card).

## Result
PASS → proceed to `docs/FINAL_RELEASE_PLAN.md` GO checklist. FAIL any red row →
capture the exact input + `[AbuAI][…]` console line and file it as the next fix.
