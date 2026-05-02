# 10 — Discovery Map

> Full system inventory. Every file, every screen, every pattern. Evidence-only, no recommendations.

## File Inventory

| File | Lines | Type | Role |
|------|-------|------|------|
| `src/screens/Home/index.tsx` | 916 | Screen | Entry hub, service grid, geolocation, brand hero |
| `src/screens/Home/data.ts` | 54 | Data | 9 service definitions, greetings |
| `src/screens/Home/icons.tsx` | 98 | Icons | 9 SVG fallback icons |
| `src/screens/AbuAI/index.tsx` | 1,373 | Screen | Chat + voice AI conversation |
| `src/screens/AbuAI/service.ts` | — | Service | AI message generation (OpenAI/Groq/Gemini) |
| `src/screens/AbuAI/types.ts` | — | Types | ChatMessage interface |
| `src/screens/AbuWhatsApp/index.tsx` | 1,409 | Screen | WhatsApp message generation + voice mode |
| `src/screens/AbuWhatsApp/service.ts` | — | Service | Message generation API |
| `src/screens/AbuCalendar/index.tsx` | 1,135 | Screen | Calendar grid, voice/manual entry, alerts |
| `src/screens/AbuCalendar/service.ts` | — | Service | Appointment CRUD, Groq parsing, emoji detection |
| `src/screens/AbuWeather/index.tsx` | 828 | Screen | Weather display, animated sky, briefing |
| `src/screens/AbuWeather/service.ts` | — | Service | Weather API, sky gradients, mood mapping |
| `src/screens/AbuGames/index.tsx` | 634 | Screen | Game grid, WOW Solitaire featured |
| `src/screens/FamilyGallery/index.tsx` | 402 | Screen | Photo masonry gallery |
| `src/screens/Settings/index.tsx` | 711 | Screen | Accordion settings, contacts, services |
| `src/screens/Admin/index.tsx` | 488 | Screen | PIN-protected config management |
| `src/screens/Opening/index.tsx` | 25 | Screen | Loading redirect |
| `src/screens/Offline/index.tsx` | 40 | Screen | No internet state |
| `src/screens/Error/index.tsx` | 16 | Screen | Service URL error |
| `src/components/BackToHome/index.tsx` | 30 | Component | House icon back button (Phosphor) |
| `src/components/InfoButton.tsx` | 136 | Component | Help overlay modal |
| `src/components/Shell/index.tsx` | 30 | Component | Screen wrapper, safe area |
| `src/components/Header/index.tsx` | 34 | Component | Subtitle header bar |
| `src/components/ServiceTile/index.tsx` | 25 | Component | Unused/legacy tile |
| `src/components/ServiceLogo/index.tsx` | 39 | Component | Image fallback chain |
| `src/components/BottomBar/index.tsx` | 15 | Component | Version display footer |
| `src/components/ErrorBoundary/index.tsx` | 56 | Component | Crash recovery UI |
| `src/components/MoreModal/index.tsx` | 37 | Component | 9th service overlay |
| `src/components/InstallGuidance/index.tsx` | 36 | Component | PWA install prompt |
| `src/components/UpdateToast/index.tsx` | 17 | Component | Update notification |
| `src/components/TileSkeleton/index.tsx` | 10 | Component | Loading placeholder |
| `src/services/voice.ts` | 666 | Service | TTS (6-provider fallback), silence detection, iOS unlock |
| `src/services/sounds.ts` | 170 | Service | Web Audio API sound synthesis |
| `src/services/navigationService.ts` | 99 | Service | Navigation state machine, debounce |
| `src/services/storageService.ts` | 127 | Service | IndexedDB abstraction |
| `src/services/familyPhotos.ts` | 98 | Service | 7 family photos, gallery items |
| `src/services/martitaPhotos.ts` | 48 | Service | 25 Martita portrait pool |
| `src/services/adminService.ts` | 86 | Service | PIN hash (SHA-256), lockout |
| `src/design/tokens.ts` | 113 | Design | CSS custom property mirrors (DEAD CODE) |
| `src/state/store.ts` | 37 | State | Zustand store |
| `src/state/types.ts` | 90 | State | Screen enum, interfaces |
| `src/state/defaults.ts` | 15 | State | 9 default services |
| `src/App.tsx` | 156 | Root | Initialization, lifecycle, routing |
| `src/main.tsx` | 16 | Entry | ReactDOM, tokens.css import |

**Total: ~11,099 lines across 45 files**

## State Management Map

### Global (Zustand store)
- `screen` — current active screen
- `activeServiceId` — selected service for iframe
- `services` — 9 service definitions (editable via Admin)
- `setScreen`, `setActiveServiceId`, `setServices` — actions

### Per-Screen Local State

| Screen | useState count | useRef count | useEffect count | Complexity |
|--------|---------------|-------------|----------------|------------|
| Home | 11 | 0 | 2 | Medium |
| AbuAI | 12 | 11 | 2 | Very High |
| AbuWhatsApp | 14 | 12 | 1 | Very High |
| AbuCalendar | 10 | 3 | 2 | High |
| AbuWeather | 6 | 0 | 1 | Medium |
| AbuGames | 2 | 0 | 1 | Low |
| FamilyGallery | 2 | 1 | 1 | Low |
| Settings | 12 | 1 | 1 | Medium |
| Admin | 10 | 2 | 1 | Medium |

## Navigation Architecture

```
Home (hub)
├── AbuAI (voice + chat)
├── AbuWhatsApp (message generation)
├── AbuCalendar (events + alerts)
├── AbuWeather (weather display)
├── AbuGames (external game links)
├── FamilyGallery (photo masonry)
├── Settings (accordion config)
├── Admin (triple-tap from Martita photo, PIN-locked)
└── Opening → iframe for external services (9 service URLs)
```

All navigation is same-tab via `setScreen()`. No React Router. No URL-based routing. BackToHome returns to Home from any screen.

## Voice Architecture

### TTS Provider Chain (voice.ts)
1. OpenAI TTS (tts-1-hd, shimmer voice, 0.88 speed)
2. Gemini TTS (Aoede voice, PCM→WAV)
3. Azure Cognitive Services (proxy)
4. Edge TTS (proxy)
5. Google Translate TTS (proxy)
6. Web Speech API (browser built-in, fallback)

### Speech Recognition
- Primary: Web Speech Recognition API (lang=he-IL)
- Fallback: MediaRecorder → Whisper API transcription
- Silence detection: Professional (AbuAI) vs simple countdown (AbuWhatsApp)

### Voice Mode Screens
- **AbuAI**: Full conversation loop (listen→process→speak→listen)
- **AbuWhatsApp**: Command-based (listen→detect command→execute→listen)
- **AbuCalendar**: One-shot recording (record→transcribe→parse→confirm)

## Data Persistence

| Data | Storage | Location |
|------|---------|----------|
| Appointments | localStorage | `abubank-appointments` |
| Alert minutes | localStorage | `abubank-alert-minutes` |
| Services config | IndexedDB (idb) | storageService |
| Admin PIN hash | IndexedDB | storageService meta |
| Contacts | localStorage | Settings-managed |
| Location contacts | localStorage | Settings-managed |

## External Dependencies

| Service | API | Used By |
|---------|-----|---------|
| OpenAI | Chat completions, TTS, Whisper | AbuAI, voice.ts |
| Groq | Chat completions (fast) | AbuAI, AbuWhatsApp, AbuCalendar |
| Gemini | Chat completions, TTS | AbuAI, voice.ts |
| OpenWeatherMap | Current + forecast | AbuWeather |
| WhatsApp | Deep link (whatsapp://send) | Home, AbuWhatsApp, Settings |
| Google Maps | Link generation | Home (geolocation) |
