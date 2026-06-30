# CURRENT_STATE (evidence-based, 2026-06-30)

Branch: rc5/cognitive-architecture-and-acceptance (NOT merged to main — by rule)
Version: 0.8.1-conversation-brain
Deploy: https://abu-bank-7bpy7l9gp-leos-projects-d3c04c09.vercel.app

## Evidence
- `tsc --noEmit` → clean
- `vitest run` → 195 files, 5971 passed, 0 failed
- `tsc && vite build` → exit 0
- Playwright (abu-games-visual, persistence; mobile-chrome 412x870) → 2/2
- Deploy health: root 200 · /api/health buildVersion=0.8.1 · OPENAI_API_KEY present ·
  chat 200 · online 200 · realtime-token = REALTIME_PROVIDER_FAILED (down)

## Architecture (real, not aspirational)
- Pipeline: input → orchestrate (understanding) → Conversation Brain (planTurn:
  goals/actions) → Conversation OS (continuation/repair/online memory) → tools
  (calendar/online/family/memory) → Companion Experience Enforcer → Spoken Persona → TTS
- Voice: STT WebSpeech/Groq; TTS OpenAI(shimmer)→Azure→Gemini→WebSpeech fallback;
  Realtime optional, currently provider-down → quiet pipeline fallback (validated)
- Memory: src/services/durableStore.ts (IndexedDB), migration-aware
- Family: knowledge/family_data.json (source of truth) → generated memory/*, validate:family gate
- Calendar: AbuCalendar + calendarCreate/meetingIntelligence

## Real commands
dev: npm run dev | build: npm run build | test: npm run test |
typecheck: npm run typecheck | both: npm run check | preview: npm run preview
(prebuild auto-runs generate:memory + validate:family). NO lint script exists.
