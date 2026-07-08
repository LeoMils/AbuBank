# FAILURE CLUSTERS — non-green→green war room

Six read-only failure-hunter agents drove the REAL runtime (faithful production
entry pipeline) + the 2,730-conversation destruction lab + quality judge. Every
failure below was reproduced with real runtime output, root-caused, and fixed by
the single code owner. Clusters by root cause:

## ROUTING
- **Forced menu** (lab, 99 conv): "ספרי לי על X" → "עליו" produced the same answer
  twice → `dialogueManager.escalate()` emitted "פגישה, יומן, משפחה?" — a phone-tree.
  **Fix:** escalate() is now a warm, open, menu-free re-prompt. `dialogueManager.ts`.
- **Live-fact misrouting:** "מה השעה" → LLM (no clock); "כמה עולה דולר"/"מחיר בנזין" →
  LLM; transport ("מתי האוטובוס") classified online but blocked by the tool gate.
  **Fix:** clock `TIME_QUERY_RE`+time answer in `dateReasoner`; extended
  `ONLINE_HE_CURRENT`; added `ONLINE_HE_TRANSPORT` to sync the gate. `cognitiveRuntime.ts`,
  `onlineIntent.ts`.
- **"עוד פגישה" hijack:** a create containing "עוד" was stolen by the continuation
  regex → create dropped. **Fix:** anchored bare "עוד"/"הלאה" in `conversationOS.ts`.

## CONTINUITY
- **Online follow-up → calendar hijack** (weather AND sports): "ומחר?" after a live
  answer flipped to the calendar. **Fix:** `resolveFollowUp` online-context-aware +
  `ONLINE_CTX_RE` synced with sports; online focus kept even on a failed lookup.
  `contextResolver.ts`, `cognitiveRuntime.ts`.
- **Calendar property continuity:** "באיזה שעה?" after a search lost the event → LLM.
  **Fix:** `calendar_event` focus + read-only property reasoner (prior sprint).
- **Explicit context switch:** "בעצם בואי נדבר על משהו אחר" left the draft pending →
  a later "כן" could save it. **Fix:** `CONTEXT_SWITCH_RE` → drop the draft.

## CALENDAR SLOT / CREATE
- **Incremental create never saved** (P0): "תקבעי פגישה" → "באיזה יום?" → "מחר" was
  rewritten to a calendar READ; person/multi-field answers punted to LLM; "כן" never
  saved. **Fix:** gated the temporal `resolveFollowUp` rewrite on `pendingCreate`;
  `classifySignalV2` folds non-question, non-emotional turns as slot answers while
  collecting. `contextResolver.ts`, `conversationEngineV2.ts`.
- **Silent double-book:** conflict check was dead code. **Fix:** additive conflict
  warning in `executeSave` (still saves; warns). `cognitiveRuntime.ts`.
- **"מחרתיים"/"בעוד יומיים" read gap.** **Fix:** added the branch to `calendarReadReasoner`.

## REMINDERS
- **Garbage "לי" reminder** (P0): "תזכירי לי" [pause] saved a reminder titled "לי".
  **Fix:** strip standalone "לי"; reject empty/pronoun titles (ask WHAT to remind;
  never save garbage). `reminderParser.ts`, `calendarMutationReasoner.ts`.

## PRONOUN / GENDER
- **Broken Hebrew on Martita's daughter:** "מור היה נשוי לרפי" (masculine for a
  female), "בת/בן הזוג", "שליעל" (missing space). **Fix:** verb agrees with the child
  subject; gendered partner label; spacing. `familyGraph.ts` (He + Es branches).

## MEMORY RECALL
- **Recall echoed a meta-question:** "על מה דיברנו בהתחלה?" → "דיברנו על מה אמרת על
  מור". **Fix:** meta/recall questions never become the remembered topic (`isNonTopicTurn`).

## REPAIR
- **Inconsistent repair detection:** "לא הבנת אותי" / "לא זה מה ששאלתי" punted to LLM.
  **Fix:** added to `FRUSTRATION_EXTRA_RE`.

## RECOVERY / BROKEN INPUT
- **Empty/punctuation-only input** → empty LLM prompt. **Fix:** degenerate-input guard
  → gentle "לא שמעתי, תגידי שוב". `cognitiveRuntime.ts`.

## VOICE (device-adjacent, code-testable part)
- **Spoken decimals** "3.65" → "3. 65". **Fix:** mask decimals across the sentence
  splitter. `voiceShaper.ts`.

## Deferred (documented, NOT shipped — data-safety / device)
- Editing a STORED event after save (mutation/disambiguation) — needs a safe
  target-disambiguation flow; not shipped without device verification.
- Fahrenheit→Celsius conversion (provider-format-dependent, P2).
- "תמשיכי" resume of an interrupted draft (draft preserved, reply misleading; P1).
- Spelling variant "אנבל" vs "אנאבל".
