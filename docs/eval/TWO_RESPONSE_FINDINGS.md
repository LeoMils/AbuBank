# TWO-RESPONSE PREAMBLE — wired + measured on the instrument (credit-live run)

## What was done
- **Wired** the two-response path into the LIVE session (`LiveSession`, the class LiveScreen uses),
  gated behind `LIVE_PREAMBLE_TWO_RESPONSE` (default OFF, device-gated). When ON:
  `buildSessionUpdate` sets `turn_detection.create_response: false` (the server no longer auto-creates
  the turn), and the CLIENT drives it — a **TEXT-ONLY decision response** on `speech_stopped` (a preamble
  can never be voiced), then a spoken answer: the tool path speaks the grounded result, a plain turn is
  spoken by an explicit audio response. Unit-tested (`liveSession.test.ts` two-response block, 4 cases).
- Built a real **gpt-realtime WS instrument** (`scripts/realtime-instrument.mjs` + probes) that drives the
  actual model with the SHIPPING instructions + 17 tools (dumped via `SESSION_CONFIG_SNAPSHOT.json`).

## What the instrument MEASURED (the finding — expect to find things)
Query "כמה עולה הבושם בלו דה שאנל?" (a price → forces `get_current_info`), N=4 each:

| Mode | Spoken preamble | Note |
|---|---|---|
| BASELINE text (`output_modalities:['text']`) | **0/4** | the tool-selecting response is FUNCTION-CALL ONLY, no text |
| BASELINE audio (`['audio']`) | **0/4** | same — output is `function_call` only, **no audio, no transcript** |
| TWO-RESPONSE | **0/4** | decision is silent (text-only); the answer response speaks the price first |

**KEY FINDING:** on the WS instrument the model emits **NO spoken preamble** before a tool call in EITHER
text or audio mode — the tool-selecting response contains only the `function_call`. So the owner's measured
~4s "רגע, אני בודקת…" does **NOT reproduce on the instrument**; it is a **device / WebRTC-path phenomenon**
(server-VAD auto-create with `create_response:true` voicing filler, or the tool round-trip latency perceived
as a preamble). This means:

1. **Two-response's real benefit can only be confirmed on the DEVICE** — the instrument has no baseline
   preamble to remove. The mechanism is sound and now wired, so the owner's device A/B can finally measure it.
2. The device ear-check (#5) must **distinguish** what the ~4s actually is: a *spoken* "אני בודקת" (→ two-response
   fixes it) versus *silence / latency* while the tool runs (→ two-response does NOT help; the fix would be a
   faster tool, prefetch, or a soft earcon). The seconds-count + whether words are spoken is the discriminator.

## First words out (instrument, two-response)
The answer response opened directly with the price every time — e.g. "בערך 450 ש\"ח לבקבוק 100 מ\"ל של בלו
דה שאנל" — never a preamble. So **on the instrument the first words out ARE the answer**, with or without
two-response. The value of shipping two-response is purely the DEVICE audio path, which the instrument cannot see.

Evidence: `docs/eval/TWO_RESPONSE_PROBE.json`. Instrument note: the full WebRTC session config is rejected over
the WS text transport ("Unsupported option") — the probes use a minimal session (real instructions + tools);
that rejection is transport-specific, not a production defect.
