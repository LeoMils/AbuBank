# Golden Acceptance Scoreboard

**Build:** `0.26.0-calendar-zero-repro` · **Date:** 2026-07-03. Measured by `goldenAcceptanceCorpus.test.ts` through the REAL paths (ExecutiveCognitiveController / parseAppointmentText / family engine / delivery engine). Domain-locked sprint: **Calendar**.

## This sprint — Calendar (4 new real failures reproduced → fixed → zero reproducible)

| Input | Was | Now | Regression |
|---|---|---|---|
| "יש לי משהו עם מור" | `general` / LLM ("x") | calendar_search, finds מור | `gc-search-casual-person` |
| "יש לי משהו עם מוטי" | `general` / LLM | calendar_search, "אין לך פגישה עם מוטי" | `gc-search-casual-empty` |
| "פגישה בקפה מורנו" | `general` / LLM | calendar_search by PLACE, finds the event | `gc-search-by-place` |
| "מה יש לי השבוע" | "אין כלום ליום הזה" (read only today) | reads the whole week (`getWeekEvents`) | `gc-read-week` |

Root causes: (1) casual/place search phrasings weren't classified as search (only "מתי…" was); (2) the read reasoner had no "השבוע" branch and collapsed to today; (3) the search reasoner had no place search; (4) a Hebrew `\b` bug made the casual-search regex never match. Fixes at the engine: `SEARCH_CASUAL_RE` + `!isCreateIntent` guard in `classifyIntent`, week branch in `calendarReadReasoner`, place search in `calendarSearchReasoner`.

## Full scoreboard (43/43, 100%)

| Category | Score | Threshold | Status |
|---|---|---|---|
| Calendar Create | 4/4 | ≥98 | ✓ |
| Calendar Read | 4/4 | ≥98 | ✓ |
| Calendar Search | 5/5 | ≥98 | ✓ |
| Calendar UI (save path) | 2/2 | ≥98 | ✓ |
| Calendar Update/Delete | 1/1 | ≥95 | ✓ |
| Family | 10/10 | ≥98 | ✓ |
| Online | 6/6 | ≥95 | ✓ |
| Dialogue | 4/4 | ≥97 | ✓ |
| Goal Continuity | 2/2 | ≥97 | ✓ |
| Hebrew | 2/2 | ≥95 | ✓ |
| Speech | 2/2 | ≥95 | ✓ |
| Error Recovery | 1/1 | ≥95 | ✓ |

**Total 43/43.** Critical = 0 · wrong save = 0 · wrong family = 0 · hallucinated online = 0.

## Honest device-only remainder (not code-testable here)

Visual UI (long-message scroll, save-modal render, event-card layout, "משהו לא עבד" banner) — no jsdom/browser here; logic is correct, pixels need Leo's device.

## Verdict

**Calendar domain: ZERO reproducible failures.** All 43 Golden Corpus cases pass through the real paths. **CODE-SIDE GO · DEVICE/HUMAN HOLD** (physical mic/TTS + visual UI).
