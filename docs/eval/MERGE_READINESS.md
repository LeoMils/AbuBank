# MERGE READINESS — EAR-ONLY (do NOT execute; production serves the Aug 5 build)

Branch `rc5/cognitive-architecture-and-acceptance` @ HEAD (v0.270.0).
Mechanical state vs `origin/main`: **0 behind, 0 conflicts** — a clean merge is possible.
Every NON-DEVICE row is now green. The only work left is on the owner's phone.

| Requirement | State | Evidence |
|---|---|---|
| Flags — measured defaults that survive production | ✅ | FLAG_AUDIT.md (all 8 code-defaulted) |
| Online — question set within budget | ✅ | 87.3%/63, 0 source leaks, p95 5.2s (ONLINE_ACCEPTANCE.md) |
| Layer-2 · tool-arg fuzzing (every handler) | ✅ | toolArgFuzz.test 100 cases; oversized-input slow path fixed |
| Layer-2 · 19 realtime event invariants | ✅ | liveSession.test event-invariant block |
| Layer-2 · all 15 screens (browser harness) | ✅ | e2e/screen-invariants.spec: 15/15 pass on a prod preview (render/RTL/≥16px/no dev-QA text) |
| Session repeat-lookup guard | ✅ | repeatLookupGuard.test |
| Release gate | ✅ | rc:verify quality gates PASS (its 2 "blockers" = the intentional non-promotion) |
| MUTATION gate | ✅ | scripts/mutation-harness.mjs (the repo's own harness), extended +8 for the new code, **30/30 killed (100%)**, control OK |
| typecheck / build / full suite | ✅ | 0 / ok / 13,000+ tests pass |
| Cell-level coverage | ✅ 96.5% | 166/172; the 6 not_run are Layer-3 model-behaviour declines = device/ear (below) |

## Verdict: EAR-ONLY. Every non-device row is green.
Cell coverage 56.4% → **96.5%** across this run. The only outstanding items require the owner's
phone — there is no remaining deterministic, browser, or instrument work.

## THE COMPLETE OWNER TO-DO — this list + AUDIO_CHECK.md is everything left

### A · The PHYSICAL_DEVICE / PRODUCTION_ADAPTER rows in the production gate (qa:production-gate)
These FAIL only because they require real device/production evidence — nothing a test can supply:
1. **VOICE-QUALITY-LIVE** — needs PHYSICAL_DEVICE: warm, natural, fully-audible Hebrew heard on the phone.
2. **CAL-COMM-ROUTING-LIVE** — needs PRODUCTION_ADAPTER: a real calendar/WhatsApp/call handoff on device.
3. **RELATIONSHIP-TRUTH-LIVE** — needs PRODUCTION_ADAPTER: family answers correct on a live device turn.
4. **GREETING-LIFECYCLE** — needs PRODUCTION_ADAPTER: the one greeting + silent reconnect, on device.
5. **DIAGNOSTIC-INTEGRITY** — needs PRODUCTION_ADAPTER: the deployed commit fingerprint on the live build.
6. **LIVE-DEVICE-TRACE-HARNESS** — needs a real device trace captured from the phone.

### B · AUDIO_CHECK.md — 5 things, one link, five minutes (his ear)
full sentence audible · no second voice · she stops when he speaks · no "one word then silence" ·
and the still-open preamble ("אני בודקת") whose gap the app now records for the two-response fix.

### C · Model-behaviour declines (Layer-3, 6 cells) — heard, not asserted
The instructions TELL her to decline taxi / email / medication-alarm / money-transfer / navigation / games
(deterministically present + guarded), but that she ACTUALLY declines warmly is a device/ear check.

Nothing else remains. Do NOT merge — production still serves Aug 5; promotion is the owner's call.
