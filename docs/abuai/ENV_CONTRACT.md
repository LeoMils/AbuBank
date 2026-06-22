# AbuBank — Approved Environment / Secret Contract

This is the authoritative contract for where each provider secret may live. It is **enforced by `src/clientProviderKeyContract.test.ts`** (and `src/screens/AbuAI/serverProxyContract.test.ts` for the AbuAI text path). Violating it fails the build.

## Rule of thumb
> A **billable** provider key must NEVER be readable from client code (`import.meta.env.VITE_*`), because Vite bakes those into the public JS bundle where anyone can extract them. Billable calls go through `api/*` (server-side `OPENAI_API_KEY`). Only **free-tier, rate-limited** keys are permitted in the client, and only as an explicit, documented allowance.

## The contract

| Secret | Where it may live | Billable? | Enforced by |
|--------|-------------------|-----------|-------------|
| `OPENAI_API_KEY` | **Server only** (`api/abuai-chat`, `abuai-online`, `abuai-stt`, **`abuai-tts`**, **`realtime-token`**) | **Yes** | client guard: no `VITE_OPENAI_API_KEY` in client src |
| `VITE_OPENAI_API_KEY` | **Do NOT set in the production client build.** (Dev-only: vite.config dev proxy may read it for local `/api/abuai-chat`.) | **Yes** | client guard blocks `import.meta.env.VITE_OPENAI_API_KEY` in `src/` |
| `VITE_AZURE_TTS_KEY` | **Server / dev-proxy only** (vite.config `/api/aztts`). Never read in client `src/`. | **Yes** | client guard blocks `VITE_AZURE*` in `src/` |
| `VITE_GROQ_API_KEY` | **Client-allowed** (STT, AbuWhatsApp, AbuAI free fallback) | No (free tier, rate-limited) | allowed by contract; audited by the test |
| `VITE_GEMINI_API_KEY` | **Client-allowed** (TTS fallback, AbuWhatsApp, AbuAI free fallback) | No (free tier, rate-limited) | allowed by contract; audited by the test |

## What changed (this closure)
The billable `VITE_OPENAI_API_KEY` was previously read in **client** code in 5 places. All are now server-proxied — the key never reaches the bundle:
- `voice.ts` OpenAI TTS (×3) → **`/api/abuai-tts`** (server key).
- `realtimeVoice.ts` realtime session mint → **`/api/realtime-token`** (server mints a short-lived ephemeral `client_secret`; only that — safe for the browser — is returned).
- `AbuWhatsApp/service.ts` OpenAI tier → existing **`/api/abuai-chat`** via `sendServerChat`.
Each path keeps its free-tier fallback (Gemini / Groq / Web Speech / pipeline), so a missing server key degrades gracefully, never a raw error.

## Required production env (Vercel project settings)
- **Server (Environment Variables, all environments):** `OPENAI_API_KEY` = real key. (`VITE_AZURE_TTS_KEY` only if Azure TTS is wanted, server-side.)
- **Client/build:** `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY` (free tier). **Do NOT set `VITE_OPENAI_API_KEY` or `VITE_AZURE_TTS_KEY` in the build env** — they would be baked into the bundle.

## Residual hardening (post-pilot, non-blocking)
Groq/Gemini client keys are free-tier and rate-limited, so exposure is quota-abuse, not money. Moving them server-side too is a future hardening item, not a pilot blocker.
