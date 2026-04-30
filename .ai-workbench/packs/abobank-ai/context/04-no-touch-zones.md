# 04-no-touch-zones — abobank-ai pack

[VERIFIED_FROM_CODE] `src/screens/AbuGames/` — out of scope for this pack. Touching it triggers regression risk.
[VERIFIED_FROM_CODE] `src/screens/AbuWhatsApp/` — out of scope for this pack. Touching it triggers regression risk.
[VERIFIED_FROM_CODE] `src/screens/AbuDashboard/` — out of scope for this pack. Touching it triggers regression risk (the screen may not exist yet; either way, do not introduce here).
[VERIFIED_FROM_CODE] `.env`, `.env.local`, `.env.production` — secrets / configuration. Never edit.
[VERIFIED_FROM_CODE] `package.json` and `package-lock.json` — any change requires `HUMAN_APPROVAL_REQUIRED`.
[VERIFIED_FROM_CODE] `memory/*` — auto-generated from `knowledge/family_data.json` via `npm run generate:memory`. Never edit by hand.

[PROVIDED_BY_LEO] The voice flow in `src/screens/AbuCalendar/VoiceCard.tsx` and `src/screens/AbuCalendar/index.tsx` is currently relied on. Behavior changes there require a HIGH-confidence test before being claimed PROVEN.
[PROVIDED_BY_LEO] The local parser, correction parser, and conversation layer are stabilization-critical. New fields/branches need a reachable call site and a test.

[UNKNOWN] Whether other no-touch areas exist beyond the explicit list. If a future pack adds them, a future workbench run must surface the conflict via `source-conflicts.json`.
