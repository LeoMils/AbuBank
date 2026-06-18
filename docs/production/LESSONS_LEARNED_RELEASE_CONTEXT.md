# Lessons Learned — Release Context

## What went wrong before (and what we guard against now)

### 1. Tests passed but product failed
**Problem:** Route-only tests (checking if a function exists, not if it works) gave false confidence. Tests could be green while the deployed product showed "לא הבנתי" on every query.
**Guard:** Production proof tests now simulate actual localStorage state, seed events, and verify storage round-trips. Endpoint tests hit the real deployed preview.

### 2. OPENAI_API_KEY missing in Vercel
**Problem:** The server-side `OPENAI_API_KEY` was not set in Vercel environment variables. The `/api/abuai-chat` endpoint returned `OPENAI_API_KEY_MISSING` for every request. The app looked functional (UI loaded) but the AI brain was dead.
**Guard:** `/api/health` endpoint now returns `ok: false` with `OPENAI_API_KEY: "missing"`. Checked at Phase 0 of every release cycle.

### 3. VITE_OPENAI_API_KEY confused with OPENAI_API_KEY
**Problem:** `VITE_OPENAI_API_KEY` (client-bundled) was confused with `OPENAI_API_KEY` (server-only). Setting one didn't fix the other. Client key was exposed in the bundle.
**Guard:** AbuAI chat now uses server proxy exclusively (`/api/abuai-chat`). Only `VITE_GROQ_API_KEY` remains client-side (for direct Groq STT). The `serverProxyContract.test.ts` enforces no `VITE_OPENAI_API_KEY` in AbuAI source.

### 4. Realtime was disabled
**Problem:** OpenAI Realtime (WebRTC) was enabled but caused issues: no grounding (couldn't access calendar/family tools), high latency on poor connections, self-echo problems.
**Guard:** `useRealtime = false` (hardcoded line 146, `AbuAI/index.tsx`). Current pipeline: record → Groq STT (→ OpenAI STT fallback) → route → tools/LLM → TTS. Realtime code exists but is disabled. Decision documented in Phase 6.

### 5. Current pipeline latency
**Problem:** Record → STT → LLM → TTS adds 2-4 seconds of perceptible latency. User may think the app froze.
**Guard:** Visual state feedback (listening → thinking → speaking phases). TTS starts as soon as first sentence is ready. Post-TTS cooldown prevents recording the TTS output.

### 6. Groq STT failed on iPhone mp4
**Problem:** iPhone Safari records audio as `audio/mp4` (AAC in MP4 container). Groq Whisper returned 400 "invalid media" for this format.
**Guard:** iPhone mp4 detection routes directly to OpenAI STT server endpoint (`/api/abuai-stt`). Groq 400/429 errors also fall back to OpenAI. 13 regression tests cover this in `voicePipelineP0.test.ts`.

### 7. App heard its own TTS (self-echo loop)
**Problem:** After TTS playback, the microphone captured the speaker output and fed it back to STT. The app would transcribe its own response and loop.
**Guard:** Self-listening guard filters known assistant phrases ("רגע לא הצלחתי", "בואי ננסה שוב", etc.). Post-TTS cooldown (≥800ms) blocks recording after TTS ends. `isSpeaking` flag suppresses transcript processing during playback.

### 8. Groq/Gemini hit 429 rate limits
**Problem:** During voice mode with rapid fire, Groq and Gemini returned 429 (too many requests). The app showed confusing errors.
**Guard:** Per-utterance tracking (`failedKinds` set) prevents re-calling a failed provider within the same request. Provider chain: OpenAI → Groq → Gemini with automatic fallback. 429 errors produce Hebrew-friendly messages ("ננסה שוב?").

### 9. Calendar worked locally but voice did not always reach it
**Problem:** Voice transcripts like "מה יש לי מחר" were routed correctly in text mode but the voice pipeline sometimes missed the calendar path due to partial/noisy transcripts.
**Guard:** `routePersonalQuery` now handles Hebrew, Spanish, and English calendar patterns. `contextResolver.ts` expands follow-ups ("ומחר?" → "מה יש לי מחר?"). Calendar intent detector has fuzzy matching for voice-quality transcripts.

### 10. AbuWhatsApp contacts lost across preview/cache/device
**Problem:** Family contact phone numbers are stored in localStorage (`abubank.familyContacts.v1`). Each Vercel preview URL has its own localStorage origin. Clearing browser data or switching to a new preview URL wiped contacts.
**Guard:** Import/export JSON system for contacts. Operator UI (`FamilyContactsSetup`) allows bulk import from a JSON template. Scaffold IDs are validated. Phone normalization handles Israeli local format. No phone numbers in committed source.

### 11. Route-only tests gave false confidence
**Problem:** Tests checked "does `routePersonalQuery('מה יש לי היום')` return `calendar_today`?" — but never verified that the calendar actually returned events, or that the LLM produced a useful Hebrew answer.
**Guard:** Production proof tests now:
- Seed localStorage with events
- Call tool functions (getTodayEvents, getTomorrowEvents, etc.)
- Verify storage state after operations
- Hit the real deployed `/api/abuai-chat` endpoint
- Score responses for adult Hebrew quality
