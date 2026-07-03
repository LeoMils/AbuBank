# Golden Acceptance Corpus

**Build:** `0.25.0-golden-corpus-product-fix` · **Date:** 2026-07-03. The single source of truth: every REAL iPhone failure Leo reported, each with the exact bad output that WAS produced, run through the REAL paths (`ExecutiveCognitiveController` for chat, `parseAppointmentText` for the calendar UI, the family engine, the delivery engine). Source: `src/eval/goldenAcceptanceCorpus.ts` (+`.test.ts`). A case passes only when the real failure is impossible to reproduce.

## Coverage (39 cases, all categories)

| Category | Cases | Example bad output (WAS) | Now |
|---|---|---|---|
| Calendar UI (save modal path) | 2 | title = raw transcript; time = 03:00 | `פגישה עם מוטי` / 15:00 / קפה מורנו |
| Calendar Create (chat) | 4 | raw title / cancelled confirm / repeated-yes loop / wrong missing field | correct, saved once |
| Calendar Search | 2 | "באיזה יום?" | searches all days |
| Calendar Read | 3 | invented / stale events | grounded, empty→honest |
| Calendar Update/Delete | 1 | not deleted | deleted + verified |
| Family | 10 | "לאו הבן שלך" (identity for relation) | directional relation, correct |
| Online | 6 | hallucinated / "אין לי אפשרות" no reason / online for date | provider / honest fail / system clock |
| Dialogue | 4 | audio→audio-reply not resume; correction→generic; "את לא עונה"→support loop | resume / corrected / frustration |
| Goal Continuity | 2 | frustration/audio **cancels** pending create | pending kept, saved on "כן" |
| Hebrew | 2 | echoes "אני תבדוק"; "אני כאן" loop | caught + composed |
| Speech | 2 | answer cut, no resume; raw URL/markdown spoken | chunk+resume; clean speech |
| Error Recovery | 1 | generic "משהו לא עבד" no cause | save verifies persistence (UI banner = device-only) |

## Rule

Every future real failure Leo reports MUST be added here as (1) a failing case first, then fixed at the root. The corpus never shrinks.
