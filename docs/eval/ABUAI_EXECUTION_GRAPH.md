# AbuAI Execution Graph — Architecture Verification (Phase 1)

**Build:** `0.18.0-executive-cognitive-controller` · **Date:** 2026-07-03 · **Phase-1 verdict: NOT ONE PATH YET.**

## Execution graph — every input path

```
                         ┌─────────────────────────────────────────────┐
  User input             │  index.tsx                                   │
  (voice OR typed)  ──▶  │  handleSend (text)  /  handleText (voice)    │
                         └───────────────┬─────────────────────────────┘
                                         │
                          if (COGNITIVE_RUNTIME_FULL)   ← the FLAG (build-time)
                          ┌──────────────┴───────────────┐
                     TRUE │                              │ FALSE (default build)
                          ▼                              ▼
   ExecutiveCognitiveController.handleTurn      LEGACY CASCADE (~50 emit points)
   (text @508, voice @1490)                     ─ createState machine
        │                                        ─ pendingReminder / reminder intent
        ▼                                        ─ recurring create
   runFullTurn                                   ─ search / delete / modify
   → metaReason → runCognitiveTurn               ─ conversationOS continuation/recall
     → tools(llm/online) → contradiction/        ─ runCognitiveTurn date-wire (@710, PARTIAL:
       confidence guards                            no finalizer/supervisor/trace)
   → runtimeFinalizer (naturalize → dialogue     ─ tryGroundedAnswer (+LLM paraphrase)
     → supervise → deliver) → RUNTIME_FINALIZED  ─ proactive / content-world
   → assertNoBypass                              ─ online answer / general LLM stream
        │                                        ─ service.ts chatTerminalFallback
        ▼                                              │
   ONE controlled answer (stamped)              ~50 answers emitted OUTSIDE the controller
```

## Per-path-type proof (controller path)

`src/eval/runtimePathProof.test.ts` traces every path type through the controller:

| Path | reaches controller | RUNTIME_FINALIZED | bypass |
|---|---|---|---|
| typed | ✓ | ✓ | no |
| voice | ✓ | ✓ | no |
| calendar (create) | ✓ | ✓ | no |
| calendar-confirm | ✓ | ✓ | no |
| family | ✓ | ✓ | no |
| online | ✓ | ✓ | no |
| tool-response (LLM finalized) | ✓ | ✓ | no |
| continue | ✓ | ✓ | no |
| resume (recall) | ✓ | ✓ | no |
| retry / retry-again | ✓ | ✓ | no |

**Controller path: 11/11, 0 bypasses.** (This is what the deployed 0.17.0 preview ran, built with the flag on.)

## Bypass inventory (the flag-OFF default path)

| # | Bypass | index.tsx | Reaches controller? |
|---|---|---|---|
| 0 | **The flag gate itself** — `if (COGNITIVE_RUNTIME_FULL)` | 505, 1487 | master switch |
| 1 | `runCognitiveTurn` date/search/audio/frustration/read/family **partial** wire (emits without finalizer/supervisor/trace) | ~710 | **NO** |
| 2–N | Legacy cascade: createState machine, reminders, recurring, search, delete, modify, conversationOS, tryGroundedAnswer, proactive, content-world, online, general LLM stream | ~499–1250 (text) + 1500–1930 (voice) | **NO** |
| — | `service.ts` `chatTerminalFallback` (LLM last resort) | service.ts | **NO** (unless finalized) |

Total assistant answer-emit points in `index.tsx`: **51**. Under the flag-off default, ~50 of them can emit outside the controller.

## Honest Phase-1 verdict

**There is NOT exactly one execution path today.** The flag `VITE_ABUAI_COGNITIVE_RUNTIME_V2_FULL` selects between:
- **Controller path (flag on):** proven bypass-free (11/11 path types + 204-line recorded replay, all RUNTIME_FINALIZED).
- **Legacy path (flag off = default build):** ~50 answer-emit points bypass the controller.

**Why the bypasses can't just be deleted now:** the legacy path still owns four domains the controller does not yet *reason* — **reminders, recurring, delete, modify**. Making the controller the sole path (removing the flag gate + legacy cascade) before those are reasoned would silently degrade those live flows — an unverifiable regression, i.e. exactly the fake-green this sprint forbids.

**Minimal work to reach one path (safely):**
1. Add reminder / recurring / delete / modify as runtime reasoners **inside the controller** (legacy `parseReminder`/`deleteAppointment`/`updateAppointment` become **tools**, not emitters). ← this is Phase-3 reasoning, gated behind Phase-2 failure mapping.
2. Then remove the `if (COGNITIVE_RUNTIME_FULL)` gate → controller becomes the sole path.
3. Delete/neutralize the legacy cascade + the @710 partial wire.
4. Re-run `runtimePathProof` — expect the same 0 bypasses, now as the **default**.

## UPDATE — Phase 3 executed: one runtime path achieved

The 4 blocking domains are now **controller-reasoned** (`calendarMutationReasoner.ts`;
legacy `parseReminder`/`reminderStore`/`deleteAppointment`/`updateAppointment`/
`calendarCreate` helpers are TOOLS only, they emit no user text):

| Domain | Runtime intent | Tool used | Proof |
|---|---|---|---|
| reminders | `reminder` (+ pending state) | parseReminder / createReminder | mutation test + path proof |
| recurring | `calendar_recurring` | extractRecurringDay / getNextOccurrences / addAppointment | idem |
| delete | `calendar_delete` | loadAppointments / deleteAppointment | idem |
| modify | `calendar_update` | loadAppointments / updateAppointment | idem |

Then the **flag gate was hardcoded**: `const COGNITIVE_RUNTIME_FULL: boolean = true`
(env dependency removed). Both `handleSend` and `handleText` return from
`ExecutiveCognitiveController` before any legacy code — so the legacy cascade + the
@710 `runCognitiveTurn` date-wire are **dead code at runtime** (never executed).

**Bypass count: before ≈ 50 (flag-off default) → after = 0 runtime bypasses.**
`runtimePathProof`: **16/16 path types reach the controller, RUNTIME_FINALIZED, 0
bypasses** (incl. reminder/recurring/delete/modify). Static facts: no env flag,
both entries route through the controller.

### Honest caveat (why not GO)
- The legacy code is **disabled (unreachable at runtime)**, not yet **physically
  deleted** — deletion would strand ~40 now-unused imports + pre-`try` setup and is
  a high-risk follow-up. It emits nothing at runtime, but it still exists in source.
- The 4 new domains are proven on unit + path-proof, **not on physical device**.
- No deploy. No production-readiness claim.
