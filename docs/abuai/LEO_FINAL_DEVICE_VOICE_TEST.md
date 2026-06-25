# Leo — Final Device Voice Test (≈5 min)

URL (open in iPhone Safari → Add to Home Screen):
**https://abu-bank-gn5z5ps70-leos-projects-d3c04c09.vercel.app**

Build `0.6.0-total-closure` · `OPENAI_API_KEY` present · chat + online routes live.
Optional: iPhone → Mac → Safari → Develop → console to watch the diagnostic lines.

> Heads-up: the OpenAI **Realtime** API is currently failing server-side
> (`/api/realtime-token` → `REALTIME_PROVIDER_FAILED`). That is EXPECTED — the app
> now falls back to the pipeline voice (STT → understand → TTS) **silently** on the
> first tap. Console shows `REALTIME_STATUS=fatal FALLBACK_REASON=realtime_unavailable → pipeline`.
> If Realtime access is enabled on the OpenAI account later, it will use it
> automatically; no code change needed.

| # | Say | Pass |
|---|---|---|
| 1 | Tap voice, allow mic | starts listening; console `AUDIO_UNLOCK_STATUS=attempted secureContext=true` |
| 2 | "מה יש לי היום" | your words appear; console `STT_SUCCESS=true STT_CHARS=…` |
| 3 | (listen to #2 answer) | **spoken aloud**; console `TTS_ENGINE_USED=… VOICE_NAME=… TTS_SUCCESS` |
| 4 | "תקבעי לי פגישה עם מור מחר בשלוש אחר הצהריים" | confirm shows **15:00** (not 03:00), person מור, asks before save |
| 5 | "איזה פגישה יש לי היום" (seed an event first) | reads the real event aloud — never "אין פגישות" |
| 6 | "מי זאת מור" → "עליה" → "תמשיכי" | stays on Mor; correct facts; no wrong relative |
| 7 | "מה מזג האוויר מחר בכפר סבא" | online answer, OR honest "אני לא מצליחה לבדוק" — never invented |
| 8 | "אני מתגעגעת לפפה" | warm, short, human, **spoken aloud**; no menu / "אין לי מידע" |
| 9 | Realtime/fallback | console `REALTIME_STATUS=fallback-pipeline` (or `fatal…→ pipeline`) and voice **still works quietly**; talk over Abu → it stops (barge-in) |

GO if: 1–9 pass, **0 text-only answers**, **0 wrong times**, **0 invented facts**,
**0 greeting loops**, fallback is quiet.
NO-GO if any of those break → send the step # + the console line.
