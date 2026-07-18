# AbuAI latency table (measured)

Targets (mandate): deterministic **<1s**, LLM **<4s**, online **<8s**. Standing law: the
benchmark is the latest ChatGPT at **NORMAL human speech pace — never slowed by default**.

## Response latency by path

| path | budget | measured | source | class |
| --- | --- | --- | --- | --- |
| deterministic (family / date / memory / calendar CRUD + referability / rambling extraction) | <1s | **0.31–0.68s** | `e2e/preview-parity.spec.ts` + `preview-typed-script.spec.ts` in-browser vs deployed preview 0.125.0/0.126.0 | PREVIEW |
| LLM (proxy → OpenAI) | <4s | **~4s** | `POST /api/abuai-chat` on preview (`ok:true`) — `docs/eval/PREVIEW_EVIDENCE_0125.md` | PREVIEW (endpoint) |
| online (retrieval) | <8s | **4.8–6.8s** | `POST /api/abuai-online` on preview (honest decline, `NO TOOL RESULT = NO CLAIM`) | PREVIEW (endpoint) |

Per-turn in-browser samples (deterministic, mobile-chrome, deployed preview): `fam-count` 0.33s,
`date-tomorrow` 0.32s, `mem-recall` 0.34s, `cal-create` 0.36s, `es-cancel` 0.33s, `he-rambling`
0.68s (the heaviest — full relation-phrase resolve + smart understanding). All **< 1s**.

## Speech PACE (how fast Martita talks) — un-slowed in 0.127.0

The applied TTS speed for the primary OpenAI path (`voice.ts` → `speed: getVoiceSpeed(lang)`)
and Web Speech (`u.rate`) both flow through `getEffectiveRate → getVoiceProfile(lang).rate`.

| | before (≤0.126.0) | after (0.127.0) |
| --- | --- | --- |
| He default rate | 0.95 (slowed ~5%) | **1.0 (normal)** |
| Es default rate | 0.97 (slowed ~3%) | **1.0 (normal)** |
| Settings scale | 0.80 / 0.88 / 0.95 (max below normal) | **0.9 / 1.0 / 1.1** (איטי / רגיל / מהיר) |
| default the user hears untouched | 0.88 shown / 0.95 applied | **1.0** |

A user who prefers slower can still choose איטי (0.9); overrides are honored and clamped to
0.8–1.15. The Realtime (WebRTC) path is model-voiced and paces itself naturally — unchanged.

## Honest limits

- **Physical time-to-first-audio and on-device speech smoothness are PHYSICAL_DEVICE evidence**
  and are NOT claimed here. The reply is currently handed to TTS as one `speak()` blob
  (`index.tsx` → `realtimeRef.speak(result.speak)`); true sentence-by-sentence audio streaming
  would change `voice.ts` and must be proven on device — a deferred item, not done here.
- The LLM/online numbers are endpoint round-trips on the preview, not full in-app conversational
  turns (the persona/cognition is client-side); they bound the network+provider component.
