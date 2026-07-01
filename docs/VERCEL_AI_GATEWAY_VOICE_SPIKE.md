# Vercel AI Gateway / AI SDK 7 — Voice Feasibility Spike (no-risk review)

Feasibility only. No implementation. [RUN]/[GREP]/[UNKNOWN] tagged.

## Current state (evidence)
- **Installed deps:** NO `ai`, `@ai-sdk/react`, `@ai-sdk/gateway`, or Vercel AI SDK —
  `node -e` over package.json returned none [RUN]. The app uses **direct-provider fetch**.
- **API architecture:** `api/abuai-chat.ts`, `abuai-online.ts`, `abuai-stt.ts`,
  `abuai-tts.ts`, `realtime-token.ts`, `health.ts` — thin Vercel serverless proxies [RUN].
- **Voice:** TTS chain OpenAI(shimmer)→Azure→Gemini→WebSpeech; STT WebSpeech/Groq;
  Realtime optional (`api/realtime-token.ts`) [CODE].
- **Realtime failure reason:** `REALTIME_PROVIDER_FAILED` — an **account/quota** condition,
  not an architecture defect [RUN]. Runtime falls back to pipeline + 5-min skip.

## Effort to adopt Vercel AI Gateway as an OPTIONAL provider
- Add `ai` + `@ai-sdk/*` deps (**gated** — `package.json` change needs approval here).
- Wrap chat/STT/TTS behind the SDK's provider routing; add an `AI_GATEWAY_API_KEY` env.
- Wire observability (traces/spend) + BYOK. Est: medium (1–2 focused days) + testing.

## AI SDK 7 voice capabilities (external — reviewer to confirm current maturity)
- Provider routing + failover, spend controls, BYOK, observability — mature/valuable [UNKNOWN version].
- `experimental_transcribe` / `experimental_generateSpeech` — usable but **experimental** [UNKNOWN].
- Realtime voice / `useRealtime` / `experimental_realtime` — **beta**, API churn likely [UNKNOWN].

## Options
| Option | Verdict |
|---|---|
| A. Ignore for now | too dismissive — Gateway offers real obs/spend value |
| **B. Post-launch optional provider** | **RECOMMENDED** |
| C. Pre-launch optional provider | not justified — adds a gated dep + testing before launch for no blocking need |
| D. Migrate before launch | rejected — speculative refactor; current voice ships with a validated fallback |

## Recommendation: **B — post-launch optional provider**
Realtime is down for **account** reasons, not architecture, so migrating voice now
(C/D) solves nothing the account fix wouldn't. After production, add the Gateway as an
OPTIONAL provider specifically to (1) improve Realtime reliability, (2) gain
spend controls + observability, (3) enable BYOK/failover — behind a feature flag,
keeping the current chain as fallback. Pre-req: confirm AI SDK 7 realtime/STT/TTS
maturity (currently beta) before committing.
