# MERGE READINESS — NOT ear-only anymore (do NOT execute; production serves the Aug 5 build)

Branch `rc5/cognitive-architecture-and-acceptance` @ HEAD (v0.280.0-earonly).

## ⚠ RE-ENUMERATION after the owner's on-device test of v0.279 (2026-08-16)
The earlier "EAR-ONLY" verdict was retired when a real device session surfaced defects a test could
not. Those CODE defects are now FIXED + verified (instrument/unit, NOT device) across v0.279–v0.281:
online richness (film 1→5 sentences), relationship-chain collapse, ICE auto-reconnect, briefing/
tool source-naming, preamble shipped ON (machine-verifiable at `/build-flags.json`), **E3** repetition
(deterministic card-dedup + spoken-repeat guard + instruction), **E5a** presence can never contradict
the session (invariant test), **E5b** never narrates internals (model-verified), and **contact
reachability** (a known-but-not-a-contact person is answered but never offered a message/call).

**Still OUTSTANDING (now genuinely device/ear, plus one data task):**
- **Device re-verification** of every fix above — preamble two-response, ICE reconnect, presence word,
  card-dedup and no-repeat are CODE/instrument evidence; only the owner's phone can confirm them heard.
- **Reachability DATA** — the code default is conservative (immediate family reachable; others opt-in
  via a `reachable:true` field). The owner should mark which friends/extended relatives are real
  contacts (via `add-family-member`), else Abu under-offers to reach them.
- **The ear-gated audio flags** below (audio-tune, barge-in, prefetch, classified-monitor) — unchanged.

So: no longer new deterministic CODE work from the transcript, BUT not merge-ready until the device
re-confirms the round-2 fixes and the reachability data is set. Not "ear-only" in the old sense.

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

## Verdict: NOT ear-only. Deterministic/instrument work remains (E3, E5a, E5b) + device re-verification.
The device test reopened code work; see the re-enumeration at the top. The rows below are still the
device/ear items, but they are no longer the ONLY outstanding work.

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

### D · DEVICE-GATED FLAG PROMOTIONS — machine-enforced, happen AFTER the ear (overnight item 1)
These live capabilities ship **OFF today, which is correct** — each is gated on the owner's ear, not code.
The hazard is not that they are off; it is that they get silently forgotten after the ear says yes (the
ONLINE_DEEP_FETCH failure). `src/services/deviceGatedFlags.ts` now makes that impossible: each flag carries
`promotionConfirmed`, and `assertDeviceGatedFlagIntegrity()` (run at boot in `main.tsx` AND in
`deviceGatedFlags.test.ts`) HARD-FAILS if a flag is confirmed but still OFF. The boot log lists every dark
capability. Promotion sequence, per flag, AFTER AUDIO_CHECK.md passes on device:

| Flag | Ships | Promote when the ear confirms | How to promote |
|---|---|---|---|
| `LIVE_AUDIO_TUNE_V2` | OFF | AUDIO_CHECK #2 (no second voice) + #3 (no "one word then silence") | set `promotionConfirmed:true` AND flip the code default ON (or the boot check throws) |
| `LIVE_BARGE_IN_TRUNCATE` | OFF | AUDIO_CHECK #3 (she stops cleanly) — enable WITH audio-tune | same; must not ship without audio-tune |
| `LIVE_PREFETCH_WARM` | OFF | device freshness-vs-latency off/on feels fresh | same |

Preamble two-response (`LIVE_PREAMBLE_TWO_RESPONSE`) is the same shape once its gap number is measured on device
(see AUDIO_CHECK #5). It is built behind a flag but stays OFF until the ~4s gap is confirmed improved.

Nothing else remains. Do NOT merge — production still serves Aug 5; promotion is the owner's call.
