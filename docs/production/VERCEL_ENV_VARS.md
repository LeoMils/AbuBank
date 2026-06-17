# Vercel Environment Variables — AbuBank

## Required Variables

| Variable | Side | Used by | Feature | If missing |
|---|---|---|---|---|
| `OPENAI_API_KEY` | Server | `api/abuai-chat.ts`, `api/abuai-online.ts` | AbuAI chat + online search | Chat falls to Groq/Gemini; online search fails |
| `VITE_OPENAI_API_KEY` | Client | `voice.ts` (TTS), `realtimeVoice.ts` | OpenAI TTS (coral voice) | Falls to Gemini TTS, then text-only |
| `VITE_GROQ_API_KEY` | Client | `service.ts` (STT + LLM) | Whisper STT + Groq LLM | STT fails; LLM falls to OpenAI/Gemini |
| `VITE_GEMINI_API_KEY` | Client | `service.ts` (LLM), `voice.ts` (TTS) | Gemini LLM + TTS fallback | LLM falls to other providers; TTS goes text-only |

## Setting in Vercel Dashboard

1. Go to https://vercel.com → Project → Settings → Environment Variables
2. Add each variable for "Production", "Preview", and "Development"
3. `VITE_` prefix variables are bundled into the client build
4. `OPENAI_API_KEY` (no prefix) is server-only — never exposed to browser

## Verification

After deploy, check:
- `https://<url>/api/health` — should return JSON
- Browser console: `[TTS-VM] trying OpenAI TTS...` → should appear on voice
- If you see `[TTS-VM] OpenAI TTS skipped: key=false` → `VITE_OPENAI_API_KEY` not set
