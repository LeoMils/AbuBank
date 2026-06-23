# AbuAI — Leo Device Validation Checklist (10–15 min)

**Purpose:** validate every remaining **device-only** item that can't be tested headless. Everything else is already proven green (4619 tests, 11 harnesses, live `gpt-4o` 20/20, deployed online 200). This is the last gate before Martita.

## Pre-flight (2 min) — do this first
- **Use the DEPLOYED URL on Martita's actual phone** (not localhost): `https://abu-bank-…vercel.app`. Local dev can't serve voice + online together.
- Open `…/api/health` once → must show `{"ok":true, "env":{"OPENAI_API_KEY":"present"}}`. If `missing` → **STOP**, set `OPENAI_API_KEY` in Vercel project env (server) and redeploy.
- Open AbuAI, tap the voice button once → the browser must **prompt for microphone permission** → tap **Allow**.
  - *Fail:* no prompt / blocked → iOS Settings ▸ Safari ▸ Microphone, or the site isn't HTTPS. **Sev P0.** Hint: `getUserMedia` needs a secure context + user gesture.
- Quiet room, phone volume up ~70%.

**Scoring:** each block 0–5. A single **hard-fail** (marked ⛔) = no-go regardless of score. Record the exact phrase/behavior on any fail.

---

## BLOCK 1 — Microphone + Hebrew STT (1.5 min)
**Do:** tap voice, say clearly in Hebrew: **"תקבעי לי תור לרופא מחר בארבע."**
- **Expected:** it records, stops on its own ~2.5 s after you finish, shows the transcribed Hebrew, and moves to a calendar confirm card.
- **PASS if:** transcript is recognizably your sentence (minor errors OK) AND it auto-stopped.
- **FAIL if:** ⛔ nothing transcribed / 404 / 401 / raw error text shown / it never stops / "התמלול לא עובד".
- **Severity:** P0 (voice is her primary modality).
- **Root-cause hints:** 404 on `/api/abuai-stt` → STT route/deploy; "client_direct_groq" path needs `VITE_GROQ_API_KEY` in the build; 400 on iPhone → mp4 should route to OpenAI Whisper fallback; 3 consecutive fails → `SttExhaustedError` ("תנסי לכתוב במקום") — that's the safe stop, not a crash.

## BLOCK 2 — Spanish STT (1 min)
**Do:** tap voice, say in Spanish: **"¿Quién es la hija de Mor?"**
- **Expected:** Spanish transcribed; answers in **Spanish** ("Mor no tiene hija." — honest, all sons).
- **PASS if:** transcript ≈ your Spanish AND the reply is Spanish (not Hebrew).
- **FAIL if:** transcribes as garbage, or replies in Hebrew to a Spanish question. **Sev P1.**
- **Hint:** Whisper auto-detects language; reply-language is set by the detected input — Hebrew reply ⇒ language detection slipped.

## BLOCK 3 — TTS playback (1 min)
**Do:** after any answer above, confirm you **hear** the voice (or trigger a spoken reply).
- **Expected:** clear spoken Hebrew/Spanish, natural pace (slow ~0.88×), warm female voice.
- **PASS if:** audible, intelligible speech plays.
- **FAIL if:** ⛔ silence / robotic chop / cuts off.
- **Severity:** P1 (text still readable, but voice is the point).
- **Root-cause hints:** total silence on iOS → audio not unlocked (must start inside a tap) — try tapping again; OpenAI TTS fails → should fall back to Gemini → Web Speech; if all silent, only text shows (by design, no robot voice).

## BLOCK 4 — Realtime conversation (2 min)
**Do:** enter live/realtime voice mode (if present), say: **"בוקר טוב, מה נשמע?"** then have a 2–3 turn back-and-forth.
- **Expected:** connects within ~10 s; she speaks, it listens, replies by voice with low latency; natural turn-taking.
- **PASS if:** at least 2 spoken exchanges work end-to-end.
- **FAIL if:** can't connect AND doesn't fall back; raw error shown; noisy repeated retry beeps.
- **Severity:** P1 — **realtime is allowed to be unavailable IF it falls back quietly** (see below).
- **Root-cause hints:** "מצב הקול לא מוגדר/לא זמין, עוברת למצב חלופי" = **expected graceful fallback** (account lacks realtime access or quota) → that is a PASS for safety, not a fail. 404 from `/v1/realtime/sessions` → missing `OpenAI-Beta` header (server-side); 429 → quota; the session token is minted server-side via `/api/realtime-token` (key never on device). Max 2 retries by design — more than that = bug.

## BLOCK 5 — Interruption / barge-in (1 min)
**Do:** while it's **speaking**, start talking over it ("רגע, עצרי…").
- **Expected:** it stops talking and listens to you (barge-in).
- **PASS if:** speech halts and your new input is captured.
- **FAIL if:** it talks over you / ignores you / both audio streams overlap. **Sev P2** (annoying, not unsafe).
- **Hint:** realtime `interrupt()` should cancel the active response on detected speech; pipeline mode stops TTS on new record.

## BLOCK 6 — Silence detection (0.5 min)
**Do:** tap voice, say one short word, then **stay silent**.
- **Expected:** recording auto-stops ~2.5 s after speech (calendar) / ~900 ms VAD (realtime); never hangs.
- **PASS if:** it stops on its own within ~3 s.
- **FAIL if:** records the full 22 s max / never stops. **Sev P2.**
- **Hint:** needs ≥1.5 s of speech before silence-stop arms; 22 s hard cap is the backstop; 20 s transcribe watchdog surfaces an honest error rather than hanging.

## BLOCK 7 — Family graph by voice (1 min)
**Do (Hebrew):** "מי זאת מור?" → then "ספרי לי עליה" → then "מי האחים של אופיר?"
- **Expected:** "מור, **הבת שלך**…"; pronoun follow-up stays on Mor; "איילון, עילי, אדר".
- **PASS if:** correct people AND her POV ("שלך", never "שלי" / "ל-Martita").
- **FAIL if:** ⛔ wrong relation / invented person / 3rd-person about her. **Sev P0 (trust).**
- **Hint:** these are deterministic (no model needed) — a wrong answer here means the wrong build is deployed.

## BLOCK 8 — Calendar by voice, save safety (1.5 min)
**Do:** "תקבעי לי רופא מחר בארבע" → wait for the **confirm card** → say/tap **"כן"** → then "מה יש לי מחר?"
- **Expected:** it **reads back** title+date+time and asks to confirm **before** saving; after "כן" it says it saved; the read shows the doctor at 16:00, **correct day**.
- **PASS if:** confirm-before-save happened AND the read-back day/time are correct.
- **FAIL if:** ⛔ it said "קבעתי" without confirming (fake save) / wrong day / event not actually there on re-read.
- **Severity:** **P0 (trust — fake save / wrong day are hard-fails).**
- **Hint:** `createAppointmentSafe` round-trips through storage; ConfirmCard is mandatory (no silent save). If it saved silently, the confirm step was skipped.

## BLOCK 9 — Continuity (1 min)
**Do:** "ספרי לי על בואנוס איירס" → "כן, תמשיכי" → "ועוד?"
- **Expected:** turns 2–3 keep talking about **Buenos Aires** (not a new topic, not family).
- **PASS if:** the thread holds across the follow-ups.
- **FAIL if:** jumps topic / asks "על מה?" / repeats verbatim. **Sev P1.**
- **Hint:** "תמשיכי"/"ועוד" are continuation cues; losing the thread = context not passed to the model.

## BLOCK 10 — Online search / freshness (1 min)
**Do:** "מה מזג האוויר מחר בכפר סבא?" → then "מה חדש בעולם?"
- **Expected:** **real current** weather/news with a brief source, OR an honest "אני לא מצליחה לבדוק כרגע".
- **PASS if:** grounded current info **or** honest decline.
- **FAIL if:** ⛔ **invents** a temperature/headline that looks real but isn't.
- **Severity:** **P0 (no fake current facts).**
- **Hint:** online uses the deployed `/api/abuai-online` (web_search) — works on deploy, 200 + sources verified. A made-up number means the online path didn't run AND the honesty clause didn't fire — check the deploy.

## BLOCK 11 — Emotional support (1 min)
**Do:** "קצת בודד לי היום" → then "אני מתגעגעת לפאפי."
- **Expected:** presence ("אני כאן איתך"), warm, short; on Pepe — gentle, invites to share, **never clinical**, no date volunteered, "Ja ja" not "חחח" if laughing.
- **PASS if:** warm + present + not a tips-list + not patronizing.
- **FAIL if:** robotic / "איך אפשר לעזור?" / therapy-bot ("איך זה גורם לך להרגיש") / lists options like a menu. **Sev P1.**
- **Hint:** emotion suppresses lookups (no family/calendar mid-grief); banned-phrase composer strips support-register.

## BLOCK 12 — Sustained long conversation (1 min)
**Do:** keep going ~6–8 mixed turns (family → calendar → chat → Spanish → emotional), then ask "מה דיברנו קודם?"
- **Expected:** stays coherent, no contradictions, recalls earlier people/topics, no fabricated family facts late in the chat.
- **PASS if:** coherent throughout AND no invented relation/event appears.
- **FAIL if:** contradicts itself / invents a relative / loses who's who. **Sev P1.**
- **Hint:** summary memory updates every ~10/20 turns; a late hallucination ⇒ check the proxy/summary path.

---

## Wrap-up scoring (1 min)
| Block | Item | Score 0–5 | Hard-fail? |
|------|------|-----------|-----------|
| 1 | Mic + Hebrew STT | | ⛔ |
| 2 | Spanish STT | | |
| 3 | TTS playback | | |
| 4 | Realtime (or quiet fallback) | | |
| 5 | Interruption | | |
| 6 | Silence auto-stop | | |
| 7 | Family by voice | | ⛔ |
| 8 | Calendar save safety | | ⛔ |
| 9 | Continuity | | |
| 10 | Online freshness | | ⛔ |
| 11 | Emotional support | | |
| 12 | Long conversation | | |

### Go / No-Go rule
- **GO (proceed to Martita pilot):** **0 hard-fails (⛔)** AND average ≥ **3.5/5** AND Blocks 1, 7, 8, 10 each ≥ 3.
- **FIX-AND-RETRY:** any non-hard-fail block < 3 → note the root-cause hint, fix, re-run only that block.
- **NOT READY:** any ⛔ hard-fail (no transcription, fake save, wrong day, invented current fact, wrong/invented family relation).

### What a result means
- All ⛔ pass + good scores → device layer validated → hand to Martita with `MARTITA_PASS_FAIL_SCORECARD.md`.
- Realtime unavailable but **falls back quietly** → still a PASS (pipeline STT→chat→TTS covers it).
- Any ⛔ → it's almost certainly the **deploy/env** (wrong build, missing server key, missing online route), not the validated app logic — re-check `…/api/health` and the deployed commit `95b26ed`.
