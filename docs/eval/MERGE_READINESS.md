# MERGE READINESS — enumerated, not asserted (do NOT execute; production serves the Aug 5 build)

Branch `rc5/cognitive-architecture-and-acceptance` @ f3ee057 (v0.263.0).
Mechanical state vs `origin/main`: **0 behind, 499 ahead, 0 conflicts** — a clean merge/fast-forward
is possible with no rebase needed. But the CONTENT is not ready. The gate below is content, not git.

| Requirement | State | Evidence / why |
|---|---|---|
| Every flag has a measured default that survives production | ✅ | FLAG_AUDIT.md — no flag fails invisibly on a merge; ONLINE_DEEP_FETCH is now a code default |
| Online passes its question set within budget | ✅ | 87.3%/63 questions, 0 hard fails, 0 source leaks, p95 5.2s (ONLINE_ACCEPTANCE.md) |
| Device P0s from the last session fixed | ✅ (2 of 3) | full-name lookup (v0.261) + misheard→suggest (v0.263). M1 preamble is the 3rd — see below |
| Layer-2 wiring green (tool arg fuzzing, 19 events, 15 screens) | ❌ | NOT STARTED (Track 3) — the declared sacrifice this session |
| M2 repair enabled OR explicitly deferred with reason | ⏸ DEFERRED | detectors observe; repair needs device warmth + round-trip latency measurement (heavy filtering = stilted) |
| All gates green incl mutation + production gate | ⚠ PARTIAL | typecheck 0 / build ok / 12,860 tests pass; mutation gate + the release-gate skill NOT run this session |
| Nothing remains except ear-verification | ❌ | M1 preamble (architecture), Layer-2 wiring, far-field VAD tuning, session-level repeat-lookup guard all remain |

## Verdict: NOT merge-ready
Mechanically mergeable (0 conflicts), but three content gates are open: Layer-2 wiring (not started),
the release/mutation gate (not run), and the M1 preamble (architecture-level, still heard every tool
call). The merge is PREPARED (rebase-free, conflict-free) and must NOT be executed — owner approval +
these gates first.

## The honest blocker the owner must know: M1 preamble is architecture-open
The device session shows 5/5 preambles ("שנייה, אני בודקת") before tool calls. This is NOT a missing
instruction — deleting the dead text was necessary-not-sufficient. In this realtime architecture the
tool-calling response streams its audio AS it is generated, so by the time the client sees the
function_call event the preamble has ALREADY played; there is no clean client-side interception point
(the same finding as M2's no-pre-delivery-interception). A real fix needs a provider-side "silent tool
call" affordance or a two-response structure — not a blind flag flip. Flagged for a dedicated design
pass, not claimed fixed. The "exactly one active response" half is the tractable part (Track A barge-in
+ deferred-create already reduce the collisions; verify on device).

## Resume points (exact) for the next session
- Track 3 Layer-2: `scripts/eval/scopeInventoryReport.ts` seeds the cells; feed GENERATED args to
  each handler in `liveTools.ts` (missing-required/out-of-enum/unknown/wrong-type), assert handling.
- Track 4 Layer-3: enable LIVE_OUTPUT_MONITOR_REPAIR on a Preview, measure repair round-trip p50/p95
  + warmth off/on on the instrument; M5 split-bundle instruction-following on/off.
- Track 5: retune far-field VAD threshold/silence and measure on device; add the session repeat-lookup
  guard (a per-session failed-name Set in liveSession) for the misheard P0 remainder.
