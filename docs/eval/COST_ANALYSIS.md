# COST ANALYSIS — Abu AI voice, one user (overnight item 5)

Prompted by tonight's diagnosis that the OpenAI project is at **zero credit** (see the credit-exhaustion
fix, v0.271.0). This examines the running cost that was never examined, and answers the four item-5 questions.
All prices are OpenAI's published Aug-2026 Realtime rates; the estimate states its assumptions so it can be
re-checked, not trusted blind.

## 1 · Does an idle timeout exist? — YES, and it is the #1 cost protection (already shipped)
`src/services/sessionLifecycle.ts` + its wiring in `realtimeVoice.ts` already implement the exact "empty room"
guard the brief worried about — an 81-year-old does not press *end*, so the session ends itself:

| Silence | Action | Cost effect |
|---|---|---|
| ~12s | `pauseUpstream()` → `track.enabled = false` | mic stops streaming → **no more audio-input tokens** |
| ~25s | one warm "את שם, מתוקה? אני כאן." | — |
| ~45s | warm goodbye ("אני נחה רגע…") → **`disconnect()`** | **session closes → billing stops entirely** |
| never | `midTask` (a response or calendar draft in flight) blocks close | never cut mid-task |

So a phone put down bleeds at most ~12s of input audio, then ~33s of an idle-but-open session (no tokens
flowing), then closes. This is already the warm-closing-line behaviour item 5 asked for. **No code change needed.**
Residual risk (named, not fixed): if `responseLeased` ever sticks `true`, `midTask` stays true and the 45s close
is defeated → an unbounded open session. In practice the 5s `REALTIME_AUDIO_TIMEOUT` watchdog cancels a stalled
response and releases the lease, so the window is ~5s — but there is no ABSOLUTE max-session cap independent of
`midTask`. A hard ceiling (e.g. force-close at 30 min regardless) would remove that last tail. Low probability;
worth a follow-up, not a P0.

## 2 · Is prompt caching used for session context? — NO explicit caching
- No `cache_control` / `prompt_cache` anywhere in `api/*` or `src/services/*` (grep-verified).
- **Realtime**: OpenAI auto-caches the static session prefix (instructions ~1,900 tokens: persona 428 + family
  699 + knowledge 274 words ≈ 1,900 tokens, sent ONCE per session via `session.update`). Cached audio input
  bills at **$0.40/1M vs $32/1M — a ~99% discount** — so the automatic cache matters a lot on multi-turn calls.
  We rely on the automatic behaviour and manage none of it explicitly; that is acceptable for realtime but
  should be VERIFIED in the usage report (cached-token count) once credit is restored.
- **Cascaded/online paths** (`abuai-online.ts`, `abuai-news.ts` → gpt-4o-mini): re-send their instruction each
  call. OpenAI auto-caches prompts >1,024 tokens, but these instructions are smaller, so most input is uncached.
  Low absolute cost (few cents/mo) — not worth engineering.

## 3 · What routes through the realtime model that a cheaper path could handle? — routing is already disciplined
| Task | Routes to | Verdict |
|---|---|---|
| Live voice conversation | **gpt-realtime** (flagship) | the cost centre; see model-choice lever below |
| Current-info / online answer | gpt-4o-mini | ✅ already cheap |
| News | gpt-4o-mini | ✅ already cheap |
| Calendar create/read/update, contact resolution | **deterministic code** (liveTools / liveContacts) | ✅ not model-routed at all |
| STT (pipeline fallback only) | whisper-1 (~$0.006/min) | only on the degraded path |

There is no obvious task wastefully routed through the expensive realtime model. The one real lever is the
**model tier itself**: `LIVE_VOICE`/model is the flagship `gpt-realtime`. **gpt-realtime-mini is ~3× cheaper**
($10/$20 vs $32/$64 per 1M audio in/out). Whether mini keeps Martita's warmth is an EAR judgment — a candidate
A/B once credit returns, not a silent switch.

## 4 · Monthly cost — one user, 30 min/day voice
**Assumptions** (stated so they can be re-checked): 30 conversation-min/day × 30 = **900 min/month**. Audio:
~600 input tokens/min, ~1,200 output tokens/min (OpenAI figures). Base rate gpt-realtime-2.1 ≈ **$0.019/min
listening + $0.077/min speaking ≈ $0.05/conversation-min**. Real bills run **2–5× base** because context
re-processes each turn on long calls (the caching caveat above).

| Scenario | Base | Realistic (2–5× turn re-processing) |
|---|---|---|
| **gpt-realtime-2.1 (flagship, current)** | 900 × $0.05 = **~$45/mo** | **~$90–$225/mo** |
| gpt-realtime-mini (~3× cheaper) | 900 × $0.016 = **~$14/mo** | **~$29–$72/mo** |
| + online/news (gpt-4o-mini) | a few cents/mo | negligible |
| + STT/TTS (fallback path only) | ~$0.006/min when used | negligible unless realtime is down |

**Headline: ~$45/mo base, realistically ~$90–225/mo for one user at 30 min/day on the flagship; ~$15–70/mo on
mini.** The three levers, in order: (a) the idle timeout — **already shipped**, bounds the empty-room bleed;
(b) keep sessions short / verify automatic caching cuts the re-processing multiplier; (c) gpt-realtime-mini if the
ear accepts it (~3× saving). None of this matters until the account has credit — that is the actual blocker.

## Sources
- OpenAI Realtime pricing (audio $32/$64 per 1M; cached input $0.40/1M): https://www.layer3labs.io/guides/openai-realtime-api-pricing
- Per-minute conversion (600 in / 1,200 out tokens per min; ~$0.05/min base; 2–5× on long calls): same guide
- Real-world session data: https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions
