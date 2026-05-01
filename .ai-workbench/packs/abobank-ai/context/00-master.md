# 00-master — abobank-ai pack

[PROVIDED_BY_LEO] AbuBank is a senior-first Hebrew/RTL PWA for Martita.
[PROVIDED_BY_LEO] AbuAI must be grounded.
[PROVIDED_BY_LEO] NO TOOL RESULT = NO CLAIM.
[PROVIDED_BY_LEO] Calendar voice must preserve title/date/time/location/note.
[PROVIDED_BY_LEO] AbuAI must sound warm, short, human, and not robotic.
[PROVIDED_BY_LEO] FreeSpeech must behave like real spoken back-and-forth conversation.
[PROVIDED_BY_LEO] Elderly UX and iOS Safari/PWA matter.
[PROVIDED_BY_LEO] No broad refactors.
[PROVIDED_BY_LEO] No dead code.
[PROVIDED_BY_LEO] Preserve existing working behavior.
[PROVIDED_BY_LEO] Do not redesign unless explicitly requested.
[PROVIDED_BY_LEO] If something cannot be proven, report NOT_PROVEN instead of implying success.
[PROVIDED_BY_LEO] If a change touches unrelated behavior, mark regression/drift risk.

[VERIFIED_FROM_CODE] The repository is a Vite + React + TypeScript PWA.
[VERIFIED_FROM_CODE] Source root is `src/`.
[VERIFIED_FROM_CODE] AbuAI screen lives under `src/screens/AbuAI/`.
[VERIFIED_FROM_CODE] AbuCalendar screen lives under `src/screens/AbuCalendar/`.
[VERIFIED_FROM_CODE] AbuGames screen lives under `src/screens/AbuGames/` (not in this pack — forbidden path).
[VERIFIED_FROM_CODE] Voice / TTS service lives under `src/services/voice.ts`.
[VERIFIED_FROM_CODE] Hebrew transcript parser lives under `src/screens/AbuCalendar/localParser.ts`.
[VERIFIED_FROM_CODE] Correction parser lives under `src/screens/AbuCalendar/correctionParser.ts`.
[VERIFIED_FROM_CODE] Conversation layer constants live under `src/screens/AbuAI/conversationLayer.ts`.
[VERIFIED_FROM_CODE] Confirmation shaper lives under `src/screens/AbuAI/responseShaper.ts`.
[VERIFIED_FROM_TEST] Test suite is run via `npm test` (vitest).
[VERIFIED_FROM_TEST] Type check is run via `npm run typecheck` (`tsc --noEmit`).
[VERIFIED_FROM_TEST] Build is run via `npm run build` (`tsc && vite build`).
[VERIFIED_FROM_CODE] No `lint` script is defined in `package.json`.

[UNKNOWN] Whether AbuAI tools are deterministic at runtime — this requires a runtime artifact to verify.
[UNKNOWN] Whether FreeSpeech currently behaves like real back-and-forth conversation — this requires a runtime artifact to verify.
[UNKNOWN] Whether iOS Safari renders the current emoji set without static-date glyphs (e.g. JUL 17) — this requires a device artifact to verify.
