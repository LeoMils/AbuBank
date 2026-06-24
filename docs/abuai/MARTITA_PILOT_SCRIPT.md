# Martita Pilot Script — 20–30 minute real session

## Honesty statement
This is a **protocol** for Leo to run with Martita. I cannot execute a live human
pilot; that is a device/human gate. Below is the exact script, what to observe,
and the pass bar — so the session produces objective evidence, not vibes.

## Setup (Leo, before)
- Real iPhone, installed PWA over HTTPS, audio on, normal home Wi-Fi.
- Seed 2–3 real events in Abu Calendar (one today with a place + subject).
- Open Safari devtools console connected (to capture the diagnostic lines:
  `STT_SUCCESS`, `TTS_ENGINE_USED`, `VOICE_NAME`, `TTS_SUCCESS`, `REALTIME_STATUS`,
  `AUDIO_UNLOCK_STATUS`).
- **No coaching.** Hand her the phone, say only "talk to Abu like you'd talk to me."

## Tasks (let her use her own words)
1. Open AbuAI, tap the voice button, wait for the greeting. *(greeting once, warm)*
2. "What do I have today?" *(calendar read aloud, full details)*
3. "Set a meeting with Mor tomorrow at three in the afternoon." *(→ 15:00, confirm)*
4. A messy one in her words: schedule with Alexandra, with a reason, a place,
   evening. *(person/place/subject understood; asks time if vague)*
5. "Who is Ari?" then "tell me more" / "about her". *(family + continuity)*
6. Something emotional in her words (missing Pepe / feeling alone). *(warm, human,
   not a menu, not "אין לי מידע")*
7. "What's the weather tomorrow?" *(online or honest decline — never invented)*
8. Interrupt Abu mid-answer by talking. *(barge-in stops playback)*
9. Go to Abu Games, open one game, come back.

## What to measure (objective, tick each)
| Observation | Pass condition |
|---|---|
| Understood what to do | started talking without help |
| Voice spoke every answer | `TTS_SUCCESS` per answer; no text-only |
| Voice felt pleasant | not robotic/old; she didn't wince |
| Greeting | exactly once; no loop |
| Calendar read | named the real event + details |
| Calendar create | correct time (3pm → 15:00), confirmed before save |
| Family + memory | correct person; "about her" stayed on her |
| Emotional reply | warm, no menu/bot/"אין לי מידע" |
| Online | answered or declined honestly; nothing invented |
| Barge-in | speaking stopped when she spoke |
| Games | reached a game and back, no horizontal scroll |
| Wanted to continue | she kept going / smiled |

## Pass bar
- 0 text-only voice answers · 0 wrong times · 0 invented facts · 0 greeting loops.
- ≥9/12 observations pass, AND all four "0" conditions hold.
- Capture screenshots + the console diagnostic block for the Go/No-Go record.
