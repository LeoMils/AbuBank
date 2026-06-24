# AbuAI Voice — iPhone Validation (Leo)

**Status:** ROOT CAUSE FIXED IN CODE + HTTPS PATH ADDED — requires real-device retest.
Voice is **not** marked green until you complete the steps below on a real iPhone.

---

## What was wrong (root cause)

The iPhone was opened at **`http://10.0.0.10:5177`** — plain **HTTP** on a LAN IP.

iOS Safari only exposes the microphone (`navigator.mediaDevices.getUserMedia`) in a
**secure context**: `https://`, `localhost`, or `127.0.0.1`. On an insecure HTTP LAN
origin, `navigator.mediaDevices` is **`undefined`**, so:

- OpenAI Realtime (WebRTC) couldn't get the mic track → retried → fell back to the pipeline.
- The pipeline greeted ("…אני כאן.") then tried Web Speech / Whisper → mic API missing → **"לא הצלחתי להתחיל הקלטה"**.
- Tapping again repeated the greeting → the loop you saw.

No retry can fix this — the mic API does not exist over insecure HTTP on iOS.

## What changed

1. **Secure-context preflight** (`src/services/micPreflight.ts`): before any mic use,
   AbuAI checks the context. If the mic can't work, it shows **one calm message**
   ("אני עדיין לא יכולה לשמוע כאן. אפשר לכתוב לי כאן בינתיים…") and **stays in text mode** —
   no greeting loop, no repeated "failed to start recording". The technical reason is
   logged to the console + diagnostics for you.
2. **HTTPS dev path**: `npm run dev:https` generates a self-signed cert (auto-covering
   this machine's LAN IPs) and serves over HTTPS so the iPhone mic works.
3. **Warmer voice**: standardized on the `shimmer` voice (pipeline + Realtime); pace
   lifted from 0.88 → 0.95 (he) / 0.97 (es) so it's calm but not "old". Config lives in
   `src/services/voiceConfig.ts`.
4. **Better opening**: one warm line that invites action instead of the dead "אני כאן."

---

## Setup (one time, on the dev machine)

```bash
npm run dev:https
```

This prints the HTTPS URLs, e.g. `https://10.0.0.10:5173/`.
(Requires `openssl` — ships with Git for Windows. `OPENAI_API_KEY` must be set in `.env`
for the premium Realtime voice; without it AbuAI uses the free pipeline.)

---

## On the iPhone — exact steps

| # | Step | Expected |
|---|------|----------|
| 1 | Open **`https://10.0.0.10:5173`** (the **https** URL, not http) | Safari shows a certificate warning |
| 2 | Tap **"Show details" → "visit this website"** to accept the self-signed cert | Page loads (AbuBank) |
| 3 | Open **Abu AI**, tap **שיחה קולית** (voice) | Safari asks **"Allow microphone?"** |
| 4 | Tap **Allow** | One warm greeting plays, then it listens (gold ring) |
| 5 | Say one Hebrew phrase: **"מה יש לי היום ביומן?"** | It transcribes and answers from the local calendar |
| 6 | Say: **"קבעי לי תור לרופא מחר בארבע"** | It reads the appointment back and asks to confirm |

### Expected results
- **Transcript** (step 5): your words appear as a user bubble (e.g. "מה יש לי היום ביומן").
- **Response**: a short spoken answer about today's calendar (or honest "I only know today/tomorrow").
- **Voice**: warm female voice (`shimmer` via OpenAI), calm pace — **not** the robotic system voice.
- **No loop**: the greeting plays **once**; no repeated "לא הצלחתי להתחיל הקלטה".

### PASS / FAIL
- **PASS** = mic permission prompt appeared, your Hebrew was transcribed, a relevant answer
  was spoken in a warm voice, and there was no greeting/error loop.
- **FAIL** = any of: no permission prompt, "failed to start recording", greeting repeats,
  or the voice is robotic/unpleasant.

---

## If it FAILS — what to send

1. The **exact URL** in Safari's address bar (http vs https matters).
2. Whether the **microphone permission prompt** appeared.
3. In Abu AI, tap the **Copy Diagnostics** control and paste the result — it includes
   `micPreflight`, the TTS engine/voice actually used, and the pipeline trace.
4. A screenshot of the screen when it failed.
5. If you saw the calm "אפשר לכתוב לי כאן בינתיים" message, you opened the **http** URL —
   reopen the **https** one (step 1).

---

## Honest scope note
- These fixes are validated by `tsc`, `vitest`, and `vite build`, and by unit tests for the
  preflight guard and voice config. **Real iPhone Safari is the source of truth** — voice
  stays **not green** until the steps above pass on your device.
