# Leo — Voice Latency + Naturalness Test (≈3 min)

URL (iPhone Safari → Add to Home Screen):
**https://abu-bank-p0pz7zyqb-leos-projects-d3c04c09.vercel.app** (or the newest
`abu-bank-*.vercel.app` Ready deployment — check `/api/health` shows the latest
`buildVersion`).

Optional: iPhone → Mac → Safari → Develop → console to copy the diagnostic lines
(`[AbuAI][LATENCY] …`, `[AbuAI][VOICE] …`).

## The 3-minute test
1. Open the URL, tap the voice button, allow the mic.
2. Say **"מה יש לי היום"** → it should start **speaking within ~3 s** of your
   words and sound natural (not robotic/slow). Console: `[AbuAI][LATENCY]
   TRANSCRIPT_TO_RESPONSE_MS=… TOTAL_TAP_TO_SPEAK_MS=…`.
3. Say **"מי זאת מור"** → short, warm spoken answer.
4. Say **"אני מתגעגעת לפאפי"** → warm and human ("כן… פאפי באמת חסר. אני איתך"),
   **not** therapy-bot, **not** a menu.
5. Say **"מזג האוויר מחר בכפר סבא"** → short spoken summary ("…נעים וחמים, בערך
   22 עד 30 מעלות"), **no URL read aloud**. Console: `ONLINE_FETCH_MS=…`.
6. Copy the `[AbuAI][LATENCY]` block.

## Pass thresholds
- Local answer (calendar/family) starts speaking **< 3 s** after the transcript.
- Online answer **< 7 s**, or an honest "אני לא מצליחה לבדוק…" (no hang).
- **0 text-only** answers (every reply is spoken; `TTS_SUCCESS` logged).
- **0 menu/robotic phrases** ("איך אפשר לעזור", "אפשר לדבר איתי", "אני כאן" dead-end).
- Voice subjectively warm/natural to your ear.

## What the code already guarantees (proven, non-device)
- Every spoken answer passes through the Spoken Persona layer: ≤2 short
  sentences, no URLs/markdown/sources, no menu/assistant/"אני כאן", weather
  naturalised — `finalVoiceExperience.test.ts` (200 outputs).
- Realtime provider is currently **down** (`REALTIME_PROVIDER_FAILED`) → the app
  falls back to the pipeline **silently** and **skips realtime for 5 min** (no
  retry storm). If Realtime is later enabled on the account it's used
  automatically.
- TTS voice: OpenAI `shimmer`, rate 0.95 (calm, not slow), instructions "warm
  Israeli woman in her 40s, native accent, never robotic".

## The only thing left for you
The **physical sound** — does the voice actually sound warm/natural and start
fast enough on the real iPhone. Everything code can control is done.
