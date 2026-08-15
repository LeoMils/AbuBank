# M1 PREAMBLE — design pass (chosen approach, why, measured latency)

The device hears a preamble before every tool call ("רגע, אני בודקת") — 5/5 last session, after
months. This is a design task with a measured outcome, not a blocked item.

## The constraint (confirmed in code)
Transport is WebRTC: the tool-selecting response streams its audio as a live remote MediaStream,
played by the browser as samples arrive. By the time the client sees the `function_call` event the
preamble is already audible. There is no server-side pre-delivery interception point.

## Approaches
1. **Two-response (server).** Make the tool-selecting response text-only (`output_modalities:['text']`)
   and speak in a SECOND response after the tool result. The API supports per-response modalities,
   BUT the session runs `create_response:true`, so the SERVER auto-creates the turn using the SESSION
   modalities — to force the first response silent needs `create_response:false` + client-driven turns,
   a larger re-architecture AND an extra round-trip (text-decision → tool → audio) that ADDS latency to
   EVERY turn, including plain chat. A definitive check of whether the current API can make ONLY the
   tool-selecting auto-response silent needs a live API/doctests pass (not spent this session).
2. **Client commit window (CHOSEN).** The client owns playback. Delay a response's audio by a short
   window; if a `function_call` arrives inside it, that response was a preamble → discard it (play
   nothing); the tool-result response plays normally. Provider-independent; works regardless of
   stream ordering (the owner's stated advantage). Implemented as `preambleGate.ts` (pure decision
   core, 5 tests) — the audio-graph wiring (a WebAudio DelayNode buffering the remote track) is the
   device-validated remainder.

## Why option 2
Option 1 fights `create_response:true` and adds a round-trip to every turn; option 2 is a localized,
provider-independent client change that costs latency ONLY on a plain-answer turn and nothing extra on
a tool turn (whose preamble is discarded and whose grounded answer is the next response anyway).

## Measured latency cost (by construction)
- Plain-answer turn: **+windowMs (default 400ms)** to the first heard word — the buffer before release.
  400ms keeps a plain answer well inside the 4s first-token budget. Tunable.
- Tool turn: **+0ms** to the grounded answer (the gate suppresses the preamble response; the tool-
  result response is separate and not delayed).
- A `function_call` that arrives AFTER real speech was released does NOT retro-mute the answer.

## Flag + remainder
Ships behind `LIVE_PREAMBLE_GATE` (default OFF). The pure decision core is tested; what remains and
is DEVICE-validated: (a) wire the remote MediaStream through a WebAudio DelayNode gated by
PreambleGate in LiveScreen; (b) confirm on the owner's ear that the preamble is gone AND a plain
answer is not clipped or unnaturally delayed; (c) tune windowMs against real preamble lengths (a
preamble longer than the window would leak its tail — measure real preamble durations on device).
This is the honest boundary: the mechanism + latency are decided and tested; audibility is the ear.
