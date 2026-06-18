# Production Gap Map

## Scoring: Current → Target → Gap → Actions

### AI Brain

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Routing accuracy** | 92/100 | 98/100 | -6 |
| **Response quality (Hebrew)** | 80/100 | 90/100 | -10 |
| **Response quality (Spanish)** | 70/100 | 85/100 | -15 |
| **Grounding (no hallucination)** | 85/100 | 95/100 | -10 |
| **Tool execution reliability** | 90/100 | 98/100 | -8 |

**Actions:**
1. P0: Fix bare time+date false create (DONE)
2. P1: Add "שבוע טוב" style greeting → warm response in system prompt few-shot
3. P1: Test meta-questions ("תני לי משהו שאת יודעת") — model hallucinates about Martita
4. P2: Add more Spanish few-shot examples in system prompt
5. P2: Test 429 recovery — does second provider actually produce quality output?

### Voice

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **STT accuracy (quiet room)** | 85/100 | 95/100 | -10 |
| **STT accuracy (noisy)** | 50/100 | 75/100 | -25 |
| **iPhone compatibility** | 75/100 | 95/100 | -20 |
| **Latency (perceived)** | 40/100 | 80/100 | -40 |
| **Self-echo prevention** | 90/100 | 99/100 | -9 |
| **TTS quality** | 70/100 | 90/100 | -20 |

**Actions:**
1. P0: Verify iPhone mp4 → OpenAI STT path works on real device (LEO ONLY)
2. P1: Stream LLM responses for faster TTS start
3. P1: Reduce silence detection threshold (2.5s → 1.5s)
4. P2: Consider Realtime hybrid for general conversation
5. P2: Add noise mode UX (push-to-talk for noisy environments)

### Calendar

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Create accuracy** | 88/100 | 95/100 | -7 |
| **Read accuracy** | 95/100 | 98/100 | -3 |
| **Date parsing** | 90/100 | 95/100 | -5 |
| **Time parsing** | 85/100 | 95/100 | -10 |
| **Persistence** | 30/100 | 90/100 | -60 |
| **Cross-device sync** | 0/100 | 80/100 | -80 |

**Actions:**
1. P0: Fix false create intent on bare time+date (DONE)
2. P1: Server-side storage for calendar events (eliminates localStorage loss)
3. P1: Calendar export/import for backup
4. P2: Time disambiguation UX (AM/PM clarification flow)
5. P2: Recurring events support

### WhatsApp

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Contact routing** | 85/100 | 95/100 | -10 |
| **Message/WhatsApp distinction** | 50/100 | 95/100 | -45 |
| **Contact persistence** | 30/100 | 90/100 | -60 |
| **Message generation quality** | 75/100 | 90/100 | -15 |

**Actions:**
1. P0: Fix message vs WhatsApp routing priority (DONE)
2. P1: Contact backup/restore workflow for preview URL changes
3. P2: Direct WhatsApp deep link (open chat, not just wa.me)

### Persistence

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Data survives URL change** | 0/100 | 100/100 | -100 |
| **Data survives browser clear** | 0/100 | 100/100 | -100 |
| **Backup/export** | 20/100 | 90/100 | -70 |
| **Import/restore** | 40/100 | 90/100 | -50 |

**Actions:**
1. P1: Server-side storage for critical data (calendar, contacts)
2. P1: Export all user data as JSON backup
3. P2: Auto-backup to cloud storage

### Security

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Secrets in git** | 95/100 | 100/100 | -5 |
| **Client key exposure** | 70/100 | 95/100 | -25 |
| **Server proxy coverage** | 85/100 | 100/100 | -15 |

**Actions:**
1. P1: Delete `openai api.txt` from working directory
2. P1: Move AbuWhatsApp service to server proxy (currently uses VITE_OPENAI_API_KEY in source)
3. P2: Rotate GROQ key (exposed in client bundle)

### UX

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **State feedback** | 75/100 | 95/100 | -20 |
| **Error messages** | 80/100 | 95/100 | -15 |
| **Voice mode clarity** | 60/100 | 90/100 | -30 |
| **Touch target size** | 90/100 | 98/100 | -8 |

**Actions:**
1. P1: Clearer voice state transitions (listening → thinking → speaking)
2. P1: Better error recovery UI (retry button, not just text)
3. P2: Haptic feedback on voice state changes

### Reliability

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Uptime monitoring** | 10/100 | 90/100 | -80 |
| **Error recovery** | 70/100 | 90/100 | -20 |
| **Rate limit handling** | 75/100 | 95/100 | -20 |
| **Graceful degradation** | 65/100 | 90/100 | -25 |

**Actions:**
1. P1: Health check monitoring (automated, not manual)
2. P1: Better rate limit recovery UX
3. P2: Offline mode for cached data
