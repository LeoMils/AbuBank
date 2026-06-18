# Production Forensics — What Made AbuAI Smart, What Made It Stupid

## What made AbuAI feel smart before?

1. **Local-first grounding** — Calendar and family queries hit deterministic tools (localStorage, family_data.json) before ever touching an LLM. "מה יש לי מחר?" gets an instant, truthful answer.

2. **OpenAI GPT-4o quality** — When the LLM path fires (general knowledge, emotional conversation), GPT-4o produces adult Hebrew. The system prompt is carefully crafted to avoid childish fillers and patronizing tone.

3. **Tri-lingual routing** — Hebrew, Spanish, English patterns all route correctly. "qué tengo mañana?" hits the same calendar pipeline as "מה יש לי מחר?".

4. **Conversation continuity** — The context resolver expands "ומחר?" after a calendar query. The message history carries context for multi-turn conversations.

5. **Confirmation flow** — Calendar creation has a natural Hebrew readback: "הבנתי. לקבוע פגישה עם מוטי מחר בשלוש. לקבוע?"

## What made AbuAI feel stupid later?

1. **Route-only testing masked dead product** — Tests checked regex matches, not whether the deployed endpoint returned content. Everything was green while the deployed app returned "לא הבנתי" for every query (missing OPENAI_API_KEY).

2. **Missing server key** — The biggest regression was architectural: moving from client-side API calls to server proxy without setting the server environment variable. The app looked alive but the brain was dead.

3. **Realtime disabled without replacement** — Realtime voice (sub-1s latency) was disabled because it bypassed grounding. The replacement pipeline (record → STT → LLM → TTS) has 3-8 second latency. Martita waits, feels ignored.

4. **Self-echo loop** — The mic captured TTS output and processed it as user speech. The app talked to itself in circles.

5. **iPhone audio rejection** — Groq STT rejected iPhone's mp4 format with 400. Users on the target device couldn't use voice at all.

6. **False calendar creation** — "מחר בערב" (casual mention of "tomorrow evening") triggered event creation. Any mention of time+date, even conversational, was interpreted as "create appointment". **Fixed this session.**

7. **WhatsApp/message confusion** — "שלחי הודעה ללאו" (send a message to Leo) was classified as WhatsApp instead of SMS/message. Regex priority was wrong. **Fixed this session.**

## What regressions happened?

| Regression | Root Cause | When |
|-----------|------------|------|
| All queries return "לא הבנתי" | OPENAI_API_KEY missing from Vercel | Deploy phase |
| Voice unusable on iPhone | Groq rejects mp4 format | Always (iPhone-specific) |
| App talks to itself | No self-echo guard in voice mode | Voice pipeline v1 |
| Realtime disabled | Bypassed grounding (no tool access) | Architecture decision |
| TTS used robot voice | Web Speech API fallback (no server TTS) | After quota exhaustion |
| Calendar events lost | localStorage cleared on preview URL change | Every Vercel deploy |
| Contacts lost | Same localStorage issue | Every Vercel deploy |

## What architectural mistakes happened?

1. **VITE_ key confusion** — Client-side `VITE_OPENAI_API_KEY` vs server-side `OPENAI_API_KEY` caused weeks of debugging. The naming convention is a trap.

2. **No health check before demo** — There was no `/api/health` endpoint to verify the server was correctly configured. Added later as P0 fix.

3. **localStorage as production storage** — Calendar events, contacts, reminders all live in localStorage. One browser clear, one URL change, and everything is gone. Not suitable for a user who doesn't understand browser mechanics.

4. **Too many TTS providers** — Azure, OpenAI, Gemini, Edge, Google Translate, Web Speech. Six fallback paths mean six places where bugs hide. A staff engineer would pick one reliable provider and invest in that.

5. **Too many LLM providers** — OpenAI, Groq, Gemini. Three providers with different capabilities, different rate limits, different tool support. Tools only work on OpenAI. Groq returns 400 for tools. Gemini has no tool support. This complexity creates bugs.

## What false positives did tests create?

1. **Route tests** — "Does `routePersonalQuery('מה יש לי היום')` return `calendar_today`?" Yes. But does the calendar actually have events? Not tested.

2. **Parser tests** — "Does `parseLocally('מחר בעשר')` return the right date?" Yes. But does the voice transcript contain "מחר בעשר" or garbled noise? Not tested.

3. **Provider tests** — "Does the provider chain fall back?" Yes in mocks. But in production, rate limits, network timeouts, and format mismatches create failure modes mocks don't cover.

4. **Green build ≠ working product** — npm test, npm run typecheck, npm run build all pass. But the deployed preview returns errors because the server environment is different from dev.

## What would a staff engineer immediately redesign?

1. **Server-side calendar storage** — Move calendar events to a database (even simple JSON in KV store). localStorage is not production storage.

2. **Single LLM provider path** — Use OpenAI GPT-4o exclusively for chat, with a simple retry. Remove Groq and Gemini from the chat path. Keep Groq only for STT (where it's cheaper).

3. **Single TTS provider** — OpenAI TTS is the best quality. Use it exclusively. Remove the 6-provider fallback chain.

4. **Streaming-first** — Stream LLM responses to reduce perceived latency. First sentence of TTS plays while the rest is still generating.

5. **Proper health monitoring** — Not just `/api/health` but actual uptime checks that alert when the product is broken.

6. **Realtime with grounding** — Re-enable Realtime but intercept transcripts for personal queries. Route calendar/family through tools, let Realtime handle general conversation. This gives sub-1s for chat with grounded answers for personal queries.
