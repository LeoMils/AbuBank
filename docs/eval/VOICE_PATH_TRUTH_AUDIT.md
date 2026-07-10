# VOICE PATH TRUTH AUDIT (Phase 1)

Evidence-based audit of what happens when Martita speaks. Two voice paths exist:
**Realtime (WebRTC)** and the **fallback pipeline (Web Speech / Whisper → `handleText`)**.

| # | Question | Realtime (before) | Fallback pipeline |
|---|---|---|---|
| 1 | Spoken audio → transcript events? | YES (`input_audio_transcription.completed` → `onUserTranscript`) | YES (Web Speech / Whisper → `handleText`) |
| 2 | Where stored? | `messages` (chat) + productTruth | `messages` + voiceDiagLog + productDiagnostics |
| 3 | Appended to the same chat history as typed text? | YES (user turn) — but the ASSISTANT turn came from the model | YES |
| 4 | Calls `ExecutiveCognitiveController` / `runFullTurn`? | **NO** — `onAssistantTranscript` was the model's own audio answer | YES (`handleText` → controller) |
| 5 | Calls AI Task Interpreter? | **NO** | YES (inside the controller) |
| 6 | Calls Calendar Builder V2? | **NO** | YES |
| 7 | Calls Family graph? | **NO** | YES |
| 8 | Calls Online Runtime? | **NO** | YES |
| 9 | Updates MemoryEngineV2 (conv)? | **NO** | YES |
| 10 | Product Truth records route/aiTask/tool for voice? | Partial (STT/TTS provider only) | YES (traceSet route/calendar/online) |
| 11 | Realtime model answers directly without AbuAI tools? | **YES ← the bug** | n/a |
| 12 | Fallback path behaves differently from Realtime? | **YES** — fallback uses the brain, Realtime did not | — |

## Root cause
The Realtime session ran with `create_response` on, so the OpenAI model auto-
answered every turn with its own native audio — it never called AbuAI's brain. It
does not know Martita's family graph, her local AbuCalendar, or live online data,
so calendar/family/online/memory "failed through voice" while working in text.

## Fix (chosen architecture — Phase 3 option 1: Realtime as STT+TTS transport)
- Realtime session: `create_response: false` → the model TRANSCRIBES but does not
  answer on its own.
- On a finalized user transcript, route it through the **same** brain as text
  (`ExecutiveCognitiveController.handleTurn`) via one shared entry `runBrainTurn`.
- Speak the brain's answer back through Realtime (`session.speak()` →
  `response.create` reading the brain reply) — native voice out, AbuAI words.
- Product Truth records `INPUT_SOURCE`, `RAW_TRANSCRIPT`, `BRAIN_PIPELINE_USED`,
  `EXECUTIVE_CONTROLLER_USED`, route, tool, calendar fields, family person, VAD.

Result: **one intelligence pipeline** — typed text and spoken transcript produce
identical decisions. Proven by the parity suites (`voiceTextParity`,
`voiceCalendarIntelligence`, `voiceFamilyIntelligence`, `voiceOnlineIntelligence`,
`voiceMemoryContinuity`). The live audio loop remains device-only.
