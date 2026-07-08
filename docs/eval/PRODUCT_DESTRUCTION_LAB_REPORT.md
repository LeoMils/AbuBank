# PRODUCT DESTRUCTION LAB — Report

**Instrument:** `src/eval/productDestructionLab.test.ts` — drives the REAL production
runtime (`ExecutiveCognitiveController.handleTurn → runFullTurn → runCognitiveTurn`),
with the production entry pipeline replicated faithfully (`resolvePronouns` +
`resolveFollowUp` run BEFORE the controller, exactly as `index.tsx` does), across
**670 multi-turn conversations**: 100 calendar · 100 online · 100 family · 100
mixed-domain · 50 emotional · 50 Spanish/mixed · 30 exit · 40 calendar-location ·
30 reminder · 20 calendar-property · 50 seeded from Leo's real iPhone corpus.

Tools are deterministic stubs (`llm` returns a `[LLM]` tag so a punt is visible;
`online` returns a tagged live answer), which isolates **real routing/continuity
decisions** from model text. Failing conversations are written in full to
`docs/eval/PRODUCT_DESTRUCTION_TRANSCRIPTS.md` as permanent evidence.

---

## 1. Failures found (across iterations)

| Round | Class | Count | Verdict |
|---|---|---|---|
| 1 | family follow-up "עליה"/"עליו" punted to LLM | 133 | **lab-faithfulness bug** — the lab bypassed `resolveFollowUp`; fixed the lab to replicate production. Not a runtime bug. |
| 2 | **online follow-up "ומחר?" hijacked to the calendar** | 208 | **REAL runtime bug** — fixed. |
| 3 | **calendar property "באיזה שעה?" lost the event → punt to LLM** | 20 | **REAL runtime bug** — fixed. |
| final | — | **0 / 670** | lab cannot reproduce further meaningful code-side failures. |

Classes probed with **zero** failures: calendar create+confirm+read-back (all
confirm variants), location retention on the saved event, reminder-not-online,
family grounding (canonical names), emotional/audio mid-create draft-keep (no false
cancel), exit-closes-draft, repeated greeting, forced menu ("באיזה יום?").

## 2. Worst transcripts BEFORE

```
# online hijack (208×)
U: מה מזג האוויר בכפר סבא?
A[online]: בכפר סבא 29 מעלות, שמש.
U: ומחר?
A[calendar_read]: מחר יש לך פגישה עם מוטי. בשלוש     ← forgot we were on weather

# calendar property lost (20×)
U: מתי הפגישה עם מור?
A[calendar_search]: יש לך פגישה עם מור מחר בשלוש.
U: באיזה שעה?
A[general/llm]: [LLM] באיזה שעה?                      ← lost which event
```

## 3. Fixes made

- **Online follow-up continuity** (`contextResolver.ts`): `resolveFollowUp` runs
  first in production and blindly expanded a bare temporal fragment to the calendar.
  It is now online-context-aware: when the prior turn was a live/online topic
  (weather/sports/news/…), it leaves the fragment for the runtime online-focus layer,
  which re-queries ONLINE (weather-tomorrow) instead of the calendar.
- **Calendar property continuity** (`cognitiveRuntime.ts`): a person-search now sets
  a `calendar_event` focus; a bare property question ("באיזה שעה?/איפה?/עם מי?/כמה
  זמן?") is answered FROM the focused event (re-reading the store for that person),
  never re-searching, never punting to the LLM. Read-only — no mutation.

## 4. Transcripts AFTER

```
U: מה מזג האוויר בכפר סבא?  → A[online]: 29 מעלות, שמש.
U: ומחר?                    → A[online]: בכפר סבא מחר … (stayed on weather) ✓

U: מתי הפגישה עם מור?       → A[calendar_search]: יש לך פגישה עם מור מחר בשלוש.
U: באיזה שעה?               → A[calendar_read]: הפגישה עם מור בשעה 15:00. ✓
```

## 5. Regressions added

- `src/eval/productDestructionLab.test.ts` — the 670-conversation lab itself, run on
  the real runtime, asserting **zero code-side failures**. Permanent.
- `src/screens/AbuAI/onlineFocusContinuity.test.ts`, `continuityThread.test.ts`,
  `pendingEditContinuity.test.ts` — targeted regressions from prior rounds.
- `docs/eval/PRODUCT_DESTRUCTION_TRANSCRIPTS.md` — regenerated every run (currently
  "Failing: 0").

## 6. Remaining CODE-side failures (honest)

- **Edit of a STORED event after save** ("תשנה לארבע" once the meeting is already
  saved) — deliberately NOT shipped: it is a data-mutation/deletion path that cannot
  be verified without a device (repo rule: do NOT delete data). Documented `it.todo`.
- **Spelling variant** "אנבל" vs canonical "אנאבל" not resolved deterministically
  (the LLM still answers). Documented `it.todo`. Low impact.

## 7. Remaining DEVICE-only failures

- The physical iPhone voice loop (WebRTC + mic + audio) — unverifiable in code. The
  Realtime ephemeral token now mints server-side (`ok=true`); the browser handshake
  needs Leo's device. The Product Truth panel reports the fallback honestly if it fails.

## 8. Preview URL

See the final chat report (deployed after this doc; Build ID visible in-app).

## 9. GO / HOLD

**HOLD** — the simulated user conversations now PASS (670/670 code-side), which was
the lab's bar, but production readiness still gates on the one device-only item
(physical iPhone voice). Every code-testable "it forgot" class the lab could
generate is fixed and regression-locked.
