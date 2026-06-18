# Latency Breakdown — Voice Pipeline

## Current Pipeline (Realtime disabled)

```
[Tap voice] → [Record] → [STT] → [Route] → [Ground/LLM] → [TTS] → [Play]
   0ms         ~2-5s      1-5s     <50ms      0-4s           1-3s     ~200ms
```

### Per-Stage Estimates

| Stage | Best Case | Typical | Worst Case | Notes |
|-------|-----------|---------|------------|-------|
| Mic activation | 0ms | 200ms | 1s | iOS permissions dialog on first use |
| Recording (silence detection) | 1.5s | 2.5s | 5s | 2.5s silence threshold after speech |
| STT: Groq Whisper | 0.8s | 1.5s | 3s | Free, fast, but rejects iPhone mp4 |
| STT: OpenAI Whisper (fallback) | 1.5s | 3s | 5s | Server proxy adds round-trip |
| Intent routing | <5ms | <10ms | <50ms | Local regex, no network |
| Grounded answer (tools) | <10ms | <20ms | <100ms | localStorage read, local compute |
| LLM: GPT-4o (if needed) | 1.5s | 3s | 8s | Network + generation time |
| TTS generation | 0.5s | 1.5s | 3s | OpenAI TTS via server |
| Audio playback start | 50ms | 200ms | 500ms | Browser audio unlock (iOS) |
| Post-TTS cooldown | 800ms | 800ms | 800ms | Fixed, prevents self-echo |

### Total Path Latencies

| Path | Stages | Best | Typical | Worst |
|------|--------|------|---------|-------|
| Calendar query (grounded) | Record → STT → Route → Tools → TTS | 3s | 5s | 10s |
| General knowledge (LLM) | Record → STT → Route → LLM → TTS | 4s | 7s | 15s |
| Calendar create + confirm | Record → STT → Route → Parse → Readback | 3s | 5s | 8s |

### Biggest Latency Contributors

| # | Contributor | Time | % of Total | Fix ROI |
|---|-----------|------|-----------|---------|
| 1 | **Recording (silence detection)** | ~2.5s | 35% | HIGH — reduce silence threshold to 1.5s |
| 2 | **LLM response** | ~3s | 25% | MEDIUM — streaming reduces perceived latency |
| 3 | **STT transcription** | ~1.5-3s | 20% | LOW — hardware/network bound |
| 4 | **TTS generation** | ~1.5s | 15% | MEDIUM — streaming TTS would help |
| 5 | **Post-TTS cooldown** | 0.8s | 10% | LOW — safety feature, hard to reduce |

## Realtime Pipeline (if re-enabled)

```
[Tap voice] → [WebRTC stream] → [Server VAD + STT + LLM + TTS] → [Audio stream]
   0ms            200ms                    500ms-1s                     continuous
```

| Stage | Latency | Notes |
|-------|---------|-------|
| WebRTC connection setup | 2-3s | One-time cost |
| Voice activity detection | <100ms | Server-side, sub-frame |
| STT + LLM + TTS (streaming) | 500ms-1s | Pipelined, not sequential |
| Total per-turn (after setup) | <1s | 10-20x faster than pipeline |

## Recommendations

1. **Highest ROI: Stream LLM responses** — Start TTS on first sentence, don't wait for full response. Reduces perceived latency by ~2s.

2. **Reduce silence detection threshold** — 2.5s → 1.5s. Users feel 2.5s of silence as "the app is stuck". 1.5s is natural conversation pause.

3. **Visual "thinking" state** — Show animated indicator immediately when recording stops. Martita needs to know the app is working, not frozen.

4. **Consider Realtime for general chat** — Keep pipeline for grounded queries (calendar, family), use Realtime for general conversation where grounding isn't needed.
