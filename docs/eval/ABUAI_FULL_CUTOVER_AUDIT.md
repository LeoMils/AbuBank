# AbuAI Full Cutover Audit — every answer-emit bypass

**Build:** `0.13.0-cognitive-runtime-v2` · **Date:** 2026-07-02 · Scope: `src/screens/AbuAI/index.tsx` (text `handleSend` + voice `handleText`) and `service.ts` (LLM).

**Definition of bypass:** any point that shows or speaks an assistant answer WITHOUT passing through `cognitiveRuntime` (`runCognitiveTurn` / `finalizeExternalAnswer`).

## Currently routed through the Cognitive Runtime (NOT bypasses)

| Path | Line | Intents owned |
|---|---|---|
| TEXT `handleSend` | ~693 | `date_query`, `calendar_search`, `audio_complaint`, `frustration` |

Everything below is a **bypass** to be cut over.

## PATH 1 — TEXT `handleSend` bypasses

| Line | Trigger | Emits | Why unsafe | Cutover plan |
|---|---|---|---|---|
| 504 | create-confirm → cancel | `shapeCreateCancelled()` | no verifier/composer | runtime `confirmation`→cancel (built, not wired) |
| 533 | create → save | "קבוע — …" readback | save+readback outside runtime verifier | runtime `confirmation`→save (built; ActionExecutor verifies) |
| 538–552 | create replace/update/read/clarify | shapers | not verified | runtime `calendar_create`/`confirmation` |
| 557 | audio mid-create | sound advice | not verified | runtime `audio_complaint` (built) |
| 572 | `adviseFreeSpeech` | advisory | not verified | classify in runtime, then route/defer |
| 597–633 | `pendingReminder` flow | reminder readbacks | reminder domain not in runtime yet | add ReminderReasoner to runtime |
| 649 | `handleConversationTurn` | continuation/challenge | conversationOS is a runtime TOOL but emitted here directly | runtime `continuation`/`frustration` |
| 658 | "על מה דיברנו" | topic recall | not verified/composed | runtime recall (in `continuation`) |
| 707 | unresolved pronoun | "למי את מתכוונת?" | not verified | runtime entity/clarification |
| 755–767 | reminder intent | reminder readbacks | reminder not in runtime | ReminderReasoner |
| 773 | `isSearchIntent` | `searchAppointments()` | **duplicate** of runtime `calendar_search` | remove; runtime owns search |
| 790–797 | `isDeleteIntent` | delete replies | mutation + answer outside runtime | runtime `calendar_delete` (classify built; executor TODO) |
| 808–849 | `isModifyIntent` | update replies | same | runtime `calendar_update` |
| 891 | recurring create | "קבעתי … כל יום" | not verified | runtime recurring |
| 931 | new single create | confirm/clarify | not verified | runtime `calendar_create` |
| 945 | abort/"not that" | warm ack | not verified | runtime small-talk |
| 994 | `tryGroundedAnswer` (+ LLM paraphrase) | family/calendar facts | **family/calendar answered outside runtime; LLM paraphrase = bypass** | runtime `family`/`calendar_read` |
| 1043 | `RECALL_RE` | recall dump | not verified | runtime recall |
| 1070 | proactive seed (+LLM) | seed/LLM | LLM bypass | finalize through runtime |
| 1101 | content world | compiled opening | not verified | finalize through runtime |
| 1116–1160 | online current-info | online result/error | **online answered outside runtime** | runtime `online` + `finalizeExternalAnswer` |
| 1168–1244 | personal / general LLM (`sendMessage`/`streamMessage`) | **direct LLM answer** | **the core "no direct LLM bypass" violation** | route via runtime; finalize every LLM answer |

## PATH 2 — VOICE `handleText` (lines 1408–1928) — **entirely bypasses the runtime**

The voice handler is a full second copy of the routing (create at 1631, reminders 1487/1525, recurring 1544, conversationOS 1698, grounded 1704, proactive 1740, online 1751, LLM stream 1780, error 1916). **Zero** runtime integration. Cutover: the voice handler must call the SAME `runCognitiveTurn`/`finalizeExternalAnswer` as text; legacy modules stay as tools only.

## PATH 3 — `service.ts` LLM

| Line | Fn | Emits | Plan |
|---|---|---|---|
| 1528 | `streamMessage` | `chatTerminalFallback` | fine as a tool, but its output must be finalized by the runtime |
| 1626 | `sendMessage` | `chatTerminalFallback` | same |

## Cutover status (this build)

- **Owned by runtime (live text):** date, calendar-search, audio-complaint, frustration.
- **Built in runtime but NOT yet the live authority:** calendar create/confirm/save, calendar read, family, continuation, online (decision only).
- **Not yet in runtime:** reminders, recurring, delete/modify execution, proactive, content-world, and the ENTIRE voice path + all direct-LLM stream answers.

The direct-LLM stream (text 1197–1244; voice 1780) and the whole voice handler are the two largest remaining bypasses and the reason this build is **HOLD**, not GO.
