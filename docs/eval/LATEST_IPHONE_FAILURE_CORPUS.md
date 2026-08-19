# Latest iPhone Failure Corpus

**Build:** `0.23.0-real-iphone-failure-fix` · **Date:** 2026-07-03. Reproduced as failing tests FIRST (`latestIphoneLiveFailureRepro`, `latestIphoneAcceptanceGate`), then fixed at the root, then re-run.

## Reproduced (observed by running Leo's exact inputs through the real path)

**EX1** — "אני צריך להיפגש מחר עם מוטי כי הוא התקשר אליי ולא נעים לי ממנו, אז אמרתי לו שכן. אני צריך להיפגש איתו מחר בשעה שלוש בקפה מורנו."
- who/when/where/title were correct (מוטי / tomorrow 15:00 / קפה מורנו / פגישה עם מוטי).
- **BUG (real):** `importantDetails` = **garbage** `"להגיע בהתקשר אליי במקום נעים לי"` — the time-correction regex misfired on "ולא נעים לי".
- **BUG (real):** the confirm **dumped the raw sentence** in `(...)` with a **double period** `..` alongside the summary.

**EX2** — "תקבעי לי פגישה מחר בארבע עם אופיר אצלה בבית. גלעד אמר שהוא יגיע בחמש, אבל אולי הוא יכול לאחר קצת."
- who/when correct (אופיר / tomorrow 16:00).
- **BUG (real):** location `"אצלה בבית"` **not resolved** to `"אצל אופיר בבית"`.
- **BUG (real):** the **גלעד detail was completely missing** (extractor only caught "can't come", not "will arrive at 5, maybe late").

## Root-cause fixes (`calendarIntelligence.ts`, `cognitiveRuntime.ts`)

| Bug | Root cause | Fix |
|---|---|---|
| Garbled detail | time-fix regex matched any "A ולא B" | require BOTH sides to be time-like (`HOURW`) |
| Missing גלעד detail | only "can't come" pattern | added "X אמר ש… (יגיע/יאחר)" extractor |
| Location "אצלה בבית" | only bare "אצלה" resolved | resolve pronoun in place, preserving trailing text |
| Raw notes dump + `..` | notes + details both shown | drop raw notes when a summary exists; collapse double periods |
| Controller ignored resolved location | used startCreate draft | prefer `smart.location` in the confirm |

## Not-a-bug (verified against real data)

The family "gender" outputs I initially suspected are **correct**: `ירדן` is female (`granddaughter_in_law`, married to `עילי`/grandson) and `ארי` is female (`great_granddaughter`) — so דודה / הכלה / נכדה are right. No family change made.

## Instrumentation (Phase 2)

`liveTurnDiagnostics.ts` — a 20-turn ring buffer (version, input, normalized, intent, source, entities, draft/missing fields, tool result, final answer, speech chunks, error). The Executive Controller records every turn. `dumpTurns()` backs a "Copy Last 20 AbuAI Turns" debug dump.

## Honestly NOT closed this sprint (needs UI work / device)

The screenshot-level UI issues (Phase 1 §9: "משהו לא עבד" surfacing, save-modal field rendering, long-answer scroll) are **UI/component** concerns — this sprint fixed the runtime/logic that feeds them (clean structured event + diagnostics), but the actual UI rendering/scroll fixes were NOT done (mission said no UI work in earlier sprints; these need component changes + device verification). Flagged honestly, not claimed green.
