# AbuAI Full Runtime Cutover Audit

**Build:** `0.14.0-thinking-runtime` · **Date:** 2026-07-02 · Scope: `src/screens/AbuAI/index.tsx` (text `handleSend` + voice `handleText` 1408–1928) + `service.ts`.

**Bypass = any final answer emitted without passing through `cognitiveRuntime` (`runCognitiveTurn` / `finalizeExternalAnswer`).**

## Routed through the runtime NOW (live default, text path)

| Intent | Where |
|---|---|
| `date_query`, `calendar_search`, `audio_complaint`, `frustration` | index.tsx ~687 |
| `calendar_read` ("מה יש לי היום/מחר") | ~687 (added this build) |
| `family` (directional, **known-only**; unknown defers to legacy) | ~687 (added this build) |

Family answers now use the new **directional `familyRelationEngine`** (correct subject/target, gender, great-uncle, ex-in-laws).

## Remaining bypasses (text `handleSend`)

| Line | Trigger | Current behavior | Why dangerous | Replaced now? | Next step |
|---|---|---|---|---|---|
| 504–557 | create-state machine (cancel/save/replace/read/clarify/audio) | shapers + real save | not through runtime verifier | **No** | runtime `confirmation`/`calendar_create` built & proven — swap emit to runtime |
| 597–633 | pending reminder | reminder readbacks | reminder domain absent from runtime | **No** | add ReminderReasoner (legacy `parseReminder` as tool) |
| 649–660 | conversationOS continuation / recall | direct replies | runtime owns these; emitted here | **No** | route through runtime `continuation` |
| 755–767 | reminder intent | readbacks | same | **No** | ReminderReasoner |
| 773 | `isSearchIntent` | `searchAppointments()` | duplicate of runtime `calendar_search` | **No** | remove; runtime owns search |
| 790–849 | delete/modify | mutation + reply | answer + mutation outside runtime | **No** | runtime `calendar_delete/update` + executor |
| 891 | recurring | "קבעתי … כל יום" | not verified | **No** | runtime recurring |
| 931 | new single create | confirm/clarify | not verified | **No** | runtime `calendar_create` |
| 994 | `tryGroundedAnswer` (+ LLM paraphrase) | family/calendar facts | family now partly on runtime; the LLM paraphrase remains a bypass | **Partial** | route residual family/calendar reads to runtime |
| 1070/1101 | proactive / content-world | seeds/openings | not verified | **No** | finalize through runtime |
| 1116–1160 | online current-info | online result/error | answered outside runtime | **No** | runtime `online` + `finalizeExternalAnswer` |
| 1168–1244 | personal / general LLM (`sendMessage`/`streamMessage`) | **direct LLM answer** | the core "no direct LLM bypass" violation | **No** | finalize every LLM answer through the runtime |

## VOICE handler (1408–1928) — **entirely bypasses the runtime**

A full second copy (create 1631, reminders 1487/1525, recurring 1544, conversationOS 1698, grounded 1704, proactive 1740, online 1751, LLM stream 1780). **Zero** runtime integration. Next step: voice calls the SAME `runCognitiveTurn`/`finalizeExternalAnswer` as text.

## `service.ts`

`streamMessage`/`sendMessage` (LLM) and `chatTerminalFallback` are fine **as tools**, but their output must be finalized by the runtime before display.

## Honest status vs. the mission's hard rule

The mission requires: *after Phase 1, no final answer emitted directly from legacy modules.* **That is NOT yet true.** The direct-LLM stream (text 1197–1244; voice 1780) and the **entire voice handler** are the two largest remaining bypasses. The full flagged cutover (`ABUAI_COGNITIVE_RUNTIME_V2_FULL`) is the next change; it is not implemented here because a rewrite of the untested 3.7k-line component can pass the suite without proving behavior — it must be built behind the flag and device-verified. **Verdict remains HOLD.**
