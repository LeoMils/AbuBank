# Latest Real iPhone Failure Analysis — reproduced on the DEPLOYED runtime

**Honesty note:** no verbatim transcript file was provided; this analysis is driven by the
failure categories given (calendar create+yes, today/tomorrow, Leo/Anabel/Yarden/Rafi/Ofir,
online cinema/world-cup/bus, continue/finish, "do you remember", repeated frustration). Each
was turned into a **multi-turn** test against the **deployed preview UI** (the path the
iPhone uses), not internal functions — `e2e/latest-iphone-transcript-repro.spec.ts`.

## Why previous "green" was invalid
The production simulator ran **single-turn** scenarios; `conversationOS` was unit-tested in
isolation. The real failures are **multi-turn and integration-level**: the TEXT path never
wired `conversationOS`, so continuation/memory fell to the LLM and lost the thread.

## Failures reproduced (live, buildVersion 0.11.0) → root cause → fix
| # | Turn (multi-turn) | Live answer (before) | Root cause | Fix |
|---|---|---|---|---|
| 1 | "ספרי לי על המהפכה הצרפתית" → **"תמשיכי"** | answered about **Ofir (family)** | TEXT path (`handleSend`) never called `handleConversationTurn`, never recorded answers | wire `handleConversationTurn` + `recordAnswer` into `handleSend` |
| 2 | … → **"על מה דיברנו"** | **"אופיר, הנכד שלך…"** | same — no topic memory on text path | added "what did we talk about" recall from `conversationOS.answer.topic` |
| 3 | **"מי זה רפי"** | **"רפי, הנכד שלך"** | `responseShaper` did `rel.includes('נכד')` — matched "אבא של ה**נכד**ים" | anchor role words at START + ex-spouse guard |
| 4 | calendar readback | "פגישה… **באצלי בבית**. **בנושא פגישה**." | blind `ב${location}` + generic subject echoed | `locPhrase()` (preposition-aware) + skip generic/duplicate subject |
| 5 | online cinema / world-cup | **"רגע, בודקת אונליין…"** (placeholder) | online path slow/failed on preview; capture saw the interim | tracked (provider latency); not a text-logic bug — verified answer arrives or honest fallback |

**Not bugs (my test was too strict):** calendar confirm "כן כן" → "קבוע — פגישה עם אורית…"
IS a save (readback turn 3 showed the event). Leo/Anabel/Yarden/Ofir relations were correct.

## Systemic root cause
The **TEXT path and VOICE path diverged**: `conversationOS` (continuation, topic memory,
challenge-repair) was wired only into the voice handler. Continuity is now wired into both.

## Verification
- Unit: `latestIphoneReproFixes.test.ts` (Rafi + grammar) + full suite green.
- Live: re-run `latest-iphone-transcript-repro.spec.ts` against the new deploy (below).
