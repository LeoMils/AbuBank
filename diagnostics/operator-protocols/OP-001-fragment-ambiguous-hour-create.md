# Operator Protocol OP-001 — Fragment ("drip") create with an ambiguous hour, on device

**Purpose:** Close the DEVICE evidence gap for the 0.68.0 fix (fragment ambiguous-hour
create parity + bare-period correction). The fix is proven at CODE / AUTOMATED_TEST only
(deterministic runtime, LLM/online stubbed). Only a physical-device run proves Martita's
real experience.

**Acceptance Board row:** Natural Conversation (🔴) · Calendar (🔴).
**Controlling behavior:** typed/voice parity — a create built across separate turns must
complete exactly like one said all at once.

## Preconditions (record exactly)
- Device model + OS version (target: Martita's actual phone; else closest iPhone).
- App surface: installed PWA (home-screen) — not a desktop browser.
- Build/version shown in Settings/About: must read `0.68.0-fragment-ambiguous-hour-parity`.
- Input mode: run the protocol **twice** — once TYPED, once by VOICE (mic).
- Language: Hebrew, feminine address.
- Network: normal Wi-Fi or cellular (note which).

## Steps — Scenario A: fragment create, accept the morning default
Say/type each line as a SEPARATE turn, waiting for AbuAI to respond before the next:
1. `תקבעי`  → expect: a short "מה לרשום?" (opens a draft; does NOT ignore you).
2. `עם מור`  → expect: a warm, person-aware next question naming מור (e.g. "לאיזה יום ושעה לקבוע עם מור?"). NOT "באיזה יום?", NOT "say it again".
3. `מחר בשמונה`  → expect: a confirm question that STATES the assumed period, e.g. "פגישה עם מור מחר בשמונה בבוקר. נכון?"
4. `כן`  → expect: "קבוע — פגישה עם מור … בשעה 08:00." and the event is created **once**.
5. Open the calendar and confirm exactly ONE event: מור, tomorrow, 08:00. No duplicate.

## Steps — Scenario B: fragment create, CORRECT to evening
1. `תקבעי`
2. `עם מור`
3. `מחר בשמונה`  → expect the "…בשמונה בבוקר. נכון?" confirm.
4. `לא בערב`  → expect AbuAI to accept the correction and re-confirm at evening, e.g. "…בשמונה בערב. נכון?" (it must NOT say "say it again" / ignore you).
5. `כן`  → expect saved at **20:00**.
6. Calendar shows exactly ONE event at 20:00 (not 08:00, not two events).

## Steps — Scenario C: parity control (single utterance)
1. `תקבעי פגישה עם מור מחר בשמונה` then `כן`.
2. Expect the SAME result as Scenario A step 4/5 (one event, 08:00). Fragment must match this.

## Response template (fill and return verbatim)
```
OP-001 result
device: <model / OS>
build shown: <e.g. 0.68.0-fragment-ambiguous-hour-parity>   [must match]
input mode: <typed | voice>   (run once each)
network: <wifi | cellular>

Scenario A (accept AM default):
  step1 מה לרשום shown?        pass/fail   observed: "____"
  step2 warm question names מור? pass/fail  observed: "____"
  step3 confirm states בבוקר?   pass/fail   observed: "____"
  step4 "כן" saved at 08:00?    pass/fail   observed: "____"
  step5 exactly ONE event?      pass/fail
Scenario B (correct to evening):
  step4 "לא בערב" accepted?     pass/fail   observed: "____"
  step5 "כן" saved at 20:00?    pass/fail   observed: "____"
  step6 exactly ONE event @20:00? pass/fail
Scenario C (single-utterance parity):
  matches Scenario A result?    pass/fail   observed time: "____"

voice-only notes (latency, was AbuAI audible/warm, did it cut you off): "____"
free-text: "____"
timestamp: <ISO local>
```

## Recording rule
Record the returned result at `DEVICE_VERIFIED` with full metadata, linked from the
Natural Conversation / Calendar Board rows. Do NOT paraphrase into a stronger claim than
the template supports. A pass here upgrades the fix from CODE to DEVICE for this flow only.
