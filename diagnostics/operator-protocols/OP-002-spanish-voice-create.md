# Operator Protocol OP-002 — Spanish calendar create by VOICE, on device

**Purpose:** Close the DEVICE evidence gap for the Spanish calendar create (§20.2). The
0.70.0–0.73.0 work made the Spanish create correct at CODE / AUTOMATED_TEST (typed input,
deterministic runtime, LLM/online stubbed): it stays in Spanish, resolves an ambiguous hour,
cancels on a Spanish "no", and titles cleanly. Only a physical-device VOICE run proves that
Spanish **speech** is transcribed correctly and that the Spanish reply is **audible and natural**.

**Acceptance Board rows:** Calendar (🔴), STT (🔴), TTS (🟡), Natural Conversation (🔴).
**Controlling behavior:** "remain in Spanish unless Martita switches language" (§20.2).

## Preconditions (record exactly)
- Device model + OS version (target: Martita's actual phone; else closest iPhone).
- App surface: installed PWA (home-screen), not desktop browser.
- Build shown in Settings/About: `0.74.0-family-possessive-spouse` **or later** (the Spanish-create
  work ships in every build from `0.73.0-spanish-create-completes` on — just confirm it is not older).
- Input mode: VOICE (microphone). Speak Rioplatense Spanish.
- App language/voice: whatever Martita actually uses.
- Network: note wifi / cellular.

## Steps — Scenario A: ambiguous hour, accept
Speak each line as a separate turn; wait for AbuAI to respond and LISTEN to the spoken reply:
1. "Agendá una reunión con Gabi mañana a las tres."  → expect a SPANISH confirm, e.g.
   "Te agendo una reunión con Gabi mañana a las 15:00. ¿Está bien?" (no Hebrew).
2. "Dale."  → expect a SPANISH save, e.g. "Listo, te agendé una reunión con Gabi mañana a las 15:00."
3. Open the calendar: exactly ONE event, Gabi, tomorrow, 15:00.

## Steps — Scenario B: ambiguous bare hour (7–11)
1. "Anotá una cita el viernes a las diez."  → expect a SPANISH confirm that STATES a time
   (e.g. "…una cita el viernes … a las 10:00. ¿Está bien?"), NOT a re-ask of "¿A qué hora?".
2. "Dale."  → expect a SPANISH save; calendar shows one event Friday at 10:00.

## Steps — Scenario C: Spanish cancel
1. "Agendá una reunión con Gabi mañana a las tres."  → Spanish confirm.
2. "No."  → expect a SPANISH cancel, e.g. "Dale, lo cancelé. Decime cuando quieras agendar algo."
   (NOT a Hebrew reply, NOT a saved event.) Calendar unchanged.

## Response template (fill and return verbatim)
```
OP-002 result
device: <model / OS>       build shown: <e.g. 0.74.0-family-possessive-spouse or later>   [must be >= 0.73.0]
input mode: voice          network: <wifi | cellular>

Scenario A (a las tres, accept):
  STT heard turn 1 correctly?         pass/fail   heard: "____"
  confirm was Spanish + audible?      pass/fail   spoken: "____"
  "Dale" saved, reply Spanish?        pass/fail   spoken: "____"
  exactly ONE event @15:00?           pass/fail
Scenario B (a las diez, ambiguous):
  confirm STATED a time (no re-ask)?  pass/fail   spoken: "____"
  saved Friday @10:00?                pass/fail
Scenario C (cancel with "No"):
  "No" cancelled in Spanish?          pass/fail   spoken: "____"
  calendar unchanged (nothing saved)? pass/fail

voice notes (latency, warmth, Spanish accent/intelligibility, any Hebrew leakage): "____"
free-text: "____"
timestamp: <ISO local>
```

## Recording rule
Record the returned result at `DEVICE_VERIFIED` with full metadata, linked from the Calendar /
STT / TTS Board rows. Do NOT paraphrase into a stronger claim than the template supports. A pass
upgrades the Spanish create from CODE to DEVICE for these flows only; Spanish STT/TTS quality is
its own evidence and must not be inferred from the typed-path tests.
```
