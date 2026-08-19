# Speech Delivery Runtime — audit

Code-side speech logic (what is spoken/displayed, where it resumes) — NOT physical TTS
voice feel or mic/STT quality (both remain device-only).

| Owner | Holds | Classify |
|---|---|---|
| `conversationDeliveryEngine` (planDelivery/advance/resume, stripForSpeech, chunks) | chunk plan + strip | **wrap** — the low-level chunker; SpeechPlanV2 uses it |
| `conversationOS.planSpokenChunks` | Hebrew-safe sentence chunking | **keep** (used by planDelivery) |
| Memory Engine v2 (`resumeLastAnswer`, chunks) | last answer + resume cursor | **migrate** — speech state serialized to/from memory |
| `speechDelivery.test.ts` | chunk/resume/no-markdown coverage | **keep** (extended) |
| UI speaking state (`index.tsx`) | live TTS play/interrupt | **device-only** (not this sprint) |
| TTS call sites (Web Speech / audio) | actual voice | **device-only** |
| "תמשיכי / לא שמעתי / תשלימי" | continuation intents | **migrate** — resolved against SpeechPlanV2 + memory |
| last answer / display storage | full answer | **keep** (Memory Engine v2) |

## Target
`speechDeliveryRuntimeV2.SpeechPlanV2` is the ONE canonical, deterministic owner of the
display text, the speech-safe chunks, the chunk cursor, replay/continue/complete modes,
interruption + error state — serializable to/from Memory Engine v2 (so speech state is
memory-backed and appears in Copy-Last-20). Full display text is always preserved; speech
is derived from it (markdown/URLs stripped); a speech failure never loses the display
answer (resumable). Physical voice feel stays device-only.
