# Project Status — AbuBank

## What This Project Is

AbuBank is a personal phone app built for Martita, an 80+ year-old grandmother living in Kfar Saba, Israel. It's her one-stop portal — a single home screen with big, easy-to-tap buttons that connect her to her banks, utility bills, phone providers, a family photo album, weather, games, a calendar, and even an AI assistant she can talk to by voice. Everything is in Hebrew, designed with large text and high contrast so she never has to squint or guess what to press.

The app runs in a phone browser (like an installed app) and is currently at version 27.2.0. It was built by family, for family — Martita is the only user.

## Technology Stack

- **Language:** TypeScript (a stricter version of JavaScript)
- **Interface framework:** React 18
- **Build tool:** Vite 5 (builds and serves the app)
- **Installable app:** PWA (Progressive Web App — works like a real app from the home screen)
- **State management:** Zustand (keeps track of what screen is showing, settings, etc.)
- **AI chat & messages:** Groq API with Llama 3.3 model
- **Voice features:** Whisper (speech-to-text), Edge TTS / Azure TTS / Google TTS (text-to-speech)
- **Hosting:** Vercel (cloud hosting service)
- **Target device:** Samsung Galaxy S25 Edge

## Current State — What Works

- **Home screen** with 9 service buttons (banks, electric, water, city tax, phone providers) in a 3×3 grid with glass-bubble look and staggered animation
- **AbuAI** — a conversational AI assistant that knows Martita's family, speaks Hebrew in feminine form, and can answer questions by voice or text
- **AbuWhatsApp** — generates warm WhatsApp messages in Martita's own writing style, with mood options (normal, warm, emotional, funny)
- **Calendar** — add/view/delete appointments, voice input for new events, birthday reminders for family, Hebrew date display, time-of-day awareness (past/next/today)
- **Weather** — live weather for Kfar Saba with animated overlays (rain, clouds, sun), Hebrew descriptions in Martita's tone
- **Games** — curated solitaire and mahjong games from trusted websites
- **Family Gallery** — photo gallery of family members
- **Photo Album** — multiple display modes (gallery, polaroid, film strip, story, circles) for Martita's photos
- **Settings** — accordion-style settings for WhatsApp group link, emergency contacts, location apps, voice preferences, service links
- **Offline screen** — friendly message when internet is down
- **Error handling** — plain Hebrew error messages, error boundaries around every screen, unhandled promise rejection catcher
- **PWA install** — can be added to home screen, auto-updates when new version is deployed
- **Accessibility** — large touch targets (48px+), high contrast, haptic feedback, screen reader labels
- **Version display** — version number always visible so family can confirm updates

## In Progress — Started But Not Finished

- **Voice barge-in** — currently Martita can only tap a button to interrupt the AI while it's speaking; interrupting by voice is not yet built
- **Thinking sound** — when the AI is "thinking" for more than 1.5 seconds, there's a visual spinner but no audio cue yet (Martita might think it froze)
- **Voice mode stability** — the voice conversation feature hasn't been stress-tested on the real phone for long sessions (10+ turns or 5+ minutes)
- **Auto-exit timeout mismatch** — voice mode exits after 20 seconds of silence, but the plan says it should wait 40 seconds (Martita may need more time)
- **AbuGames redesign** — a redesigned version of the games screen exists as a separate file but isn't active yet
- **Hebrew sentence splitting** — the AI sometimes chops Hebrew sentences awkwardly when speaking, needs tuning

## Not Started — Planned Features

- **Server-side API key protection** — right now, API keys are embedded in the app code (acceptable since Martita is the only user, but not ideal)
- **Voice watchdog timer** — if the AI gets stuck mid-thought, there's no automatic recovery yet; Martita would have to close and reopen
- **Real device testing suite** — many voice features are marked "unknown" because they haven't been verified on Martita's actual phone
- **Thinking sound effect** — a gentle audio cue while the AI processes a question

## Known Issues & Bugs

- **DEF-002:** No audio feedback while AI is thinking (visual only) — Martita might think it's frozen
- **DEF-004:** Voice mode exits too quickly (20s silence vs. planned 40s)
- **DEF-005:** "Voice conversation" button appears twice on the AI screen — confusing
- **DEF-007:** No safety timer if voice mode gets stuck — could leave Martita in a broken state
- **DEF-008:** API keys visible in app code (low risk since single user, but noted)
- **DEF-009:** Hebrew text-to-speech sometimes splits sentences mid-phrase

## Next Logical Steps

1. **Fix the duplicate voice button** on the AI screen — quick visual cleanup, removes confusion
2. **Add a thinking sound** while the AI processes — prevents Martita from thinking the app froze
3. **Increase voice timeout to 40 seconds** — gives Martita more time to think before the app exits voice mode
4. **Add a watchdog timer** to voice mode — automatically recovers if something gets stuck
5. **Test voice features on the real Galaxy S25** — many features are untested on the actual device

## How To Run Locally

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Create a .env file with your API keys
#    VITE_GROQ_API_KEY=your-groq-key
#    VITE_AZURE_TTS_KEY=your-azure-key (optional, for high-quality voice)

# 3. Start the development server
npm run dev

# 4. Open in browser (usually http://localhost:5175)
#    Or open on your phone using your computer's local IP address
```

## Last Updated

2026-04-16
