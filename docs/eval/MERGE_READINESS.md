# MERGE READINESS — re-enumerated (do NOT execute; production serves the Aug 5 build)

Branch `rc5/cognitive-architecture-and-acceptance` @ HEAD (v0.269.0).
Mechanical state vs `origin/main`: **0 behind, 0 conflicts** — a clean merge is possible. Content below.

| Requirement | State | Evidence |
|---|---|---|
| Every flag has a measured default that survives production | ✅ | FLAG_AUDIT.md — all 8 code-defaulted; ONLINE_GENERAL_SEARCH ON |
| Online passes its question set within budget | ✅ | 87.3%/63, 0 hard fails, 0 source leaks, p95 5.2s (ONLINE_ACCEPTANCE.md) |
| Layer-2 · tool-arg fuzzing (generated args, every handler) | ✅ | toolArgFuzz.test 100 cases; found+fixed oversized-input slow path |
| Layer-2 · 19 realtime event invariants | ✅ | liveSession.test event-invariant block (9 codes + 10 events) |
| Layer-2 · 15 screens via a browser harness | ⚠ PARTIAL | e2e/screen-invariants.spec: Home+Settings on a real prod preview (render/RTL/≥16px/NO QA-dev text). The DEV-gated QA badge being absent is a GLOBAL prod invariant (all screens). 13 screens' per-nav is the mechanical remainder |
| Session repeat-lookup guard | ✅ | repeatLookupGuard.test — a name that fails twice escalates to ask_different |
| Release gate run | ✅ (run) | rc:verify: quality gates PASS (aToC/provider/enlargedText/privacy). Its 2 "blockers" are the intentional non-promotion (health 0.179 alias ≠ tested) — expected, we are NOT promoting |
| Production gate run | ⚠ FAILS (device) | qa:production-gate FAILS only on rows requiring PHYSICAL_DEVICE / PRODUCTION_ADAPTER evidence (VOICE-QUALITY-LIVE, CAL-COMM-ROUTING-LIVE, …) — the ear/device remainder, not a code defect |
| Mutation gate run | ❌ N/A | No mutation gate is configured (no Stryker). Standing it up on a 12.8k-test suite is its own task — reported, not silently skipped |
| M2 repair enabled or explicitly deferred | ⏸ DEFERRED | detectors observe; enabling needs device warmth + round-trip latency measurement (realtime transport is currently failing) |
| Nothing remains except ear-verification | ❌ | NOT met — 13 screens' nav + mutation-gate setup are non-ear items still open |

## Verdict: NOT merge-ready
Cell coverage 56.4% → **89.0%** this cycle. The merge blockers named across four sessions are now
mostly closed: tool-arg fuzzing ✅, 19 event invariants ✅, repeat-guard ✅, release gate run ✅.
What remains is NOT yet "ear only":
- 13 screens' per-navigation in the browser harness (the invariant template + Home/Settings are proven;
  the global no-dev-text invariant is proven for all screens; the rest is mechanical nav).
- A mutation gate is not configured at all — standing up Stryker is a separate task.
- The production gate's device-evidence rows + M2 repair warmth are the genuine EAR/DEVICE remainder.

## Resume points
- Screens: expand e2e/screen-invariants.spec to navigate the other 13 screens (reuse the existing e2e
  nav specs' selectors) and assert the same 4 invariants.
- Mutation gate: add Stryker (or an equivalent) scoped to the core services first, not the whole suite.
- M2 repair + device-evidence rows: require the owner's device session (realtime transport was failing
  this cycle — a connection failure, not a defect; not hammered).
