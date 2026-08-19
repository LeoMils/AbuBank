# LIVE_CANDIDATE_FALSIFIED

Real iPhone (iOS 18.7, Safari/PWA, build `0.177.0-calendar-runtime-integration-rc`,
HEAD 277b986) falsified the Automatable Production Candidate. `HOSTILE CERTIFICATION
PASSED` and `AUTOMATABLE_PRODUCTION_CANDIDATE_PROVEN` are **WITHDRAWN**. Device evidence
overrides all injected-event / deployed-endpoint / unit proofs. Evidence:
`device-falsification-evidence.json` (A–K).

## Why the automated proofs missed it
Injected-event tests exercised only the **model→function-tool** path (comm/calendar
controllers). The live turn ALSO runs **onUserTranscript→ExecutiveCognitiveController**
(the legacy brain). Two runtime paths acted on the same turn → duplicate audio + legacy
calendar→call routing + `אח של מור`→Leo substitution. This violates *one runtime path per
capability* and *injected-event ≠ live*.

## Reopened (14, device-contradicted, → GAP)
CAL-RUNTIME-INTEGRATION, CAL-MIGRATION, RT-LIVE-SESSION, LATENCY-VAD-INSTRUMENTATION,
BASELINE-METRICS, DIALOGUE-QUALITY, LONG-SESSION-CONTEXT, HEBREW-CORPUS,
ONLINE-CURRENT-INFO, CONFIG-TOURNAMENT, FEATURE-ACTIVATION, WHOLE-PRODUCT-QA,
STT-INPUT, TTS-FUNCTION.

## New Critical/High rows (10)
ONE-RUNTIME-PATH-LIVE, OUTPUT-AUDIO-EXACTLY-ONCE, OUTPUT-AUDIO-INTEGRITY,
LIVE-STT-HEBREW, CAL-COMM-ROUTING-LIVE, RELATIONSHIP-TRUTH-LIVE, GREETING-LIFECYCLE,
DIAGNOSTIC-INTEGRITY, LIVE-DEVICE-TRACE-HARNESS, VOICE-QUALITY-LIVE.

## Denominator: 37 automatable Critical/High · 24 OPEN · gate FAIL · verdict FAIL.

## First campaign (before any fix): DETERMINE WHICH RUNTIME RAN
Establish which path handled each live turn (realtime slice vs legacy brain vs fallback),
how many sessions/tracks/response.create existed, and why the diagnostic shows
path=unknown/commit=local. Replace path=unknown/commit=local with a real per-turn trace.
No live-dependent row returns to PROVEN without a real-device trace passing the
LIVE-DEVICE-TRACE-HARNESS invariants. Do not patch phrases, timeouts, or greetings blindly.

## Campaign 1 result — WHICH RUNTIME RAN (first divergence, grep-proven)
- **Dual authority per live turn (root cause of D duplicate-audio + A/B legacy routing + relationship guess):**
  - `realtimeVoice.ts:78` — slice mode sets `create_response: !!sliceTools` = TRUE → the MODEL speaks its own audio.
  - `index.tsx:~2600-2648` — `onUserTranscript → ExecutiveCognitiveController.handleTurn(...) → realtimeRef.current.speak(result.speak)` → the LEGACY BRAIN independently computes a reply, an action, and SPEAKS it.
  - Result: two authorities act on every turn (model audio + brain audio) → overlapping audio; the LEGACY brain (not the control-plane draft) produced `מכינה שיחה עם מור` and `אח של מור`→Leo. The function-tool controllers are a THIRD overlay that fires only if the model emits a function_call. This is NOT one runtime path per capability. Injected-event proofs tested the overlay in isolation → blind to this.
- **Diagnostic integrity (H):** `version.ts:19 commitHint:'local'` (hardcoded, never the real SHA); `voiceFlightRecorder.ts:67 ctx={path:'unknown'}` default, never set in the realtime path; MICROPHONE_PERMISSION_GRANTED never marked → path=unknown/commit=local/first-missing-stage.

## Exact next executable action
ONE-RUNTIME-PATH-LIVE first: make a live turn have exactly ONE speaking authority in slice mode
(either the model OR the brain, not both) and route calendar/comm through the control plane —
failing-first via a real-session test that asserts a single audio authority + that a calendar
utterance does not reach the legacy comm speak path. Then DIAGNOSTIC-INTEGRITY (real commit SHA
via build injection; wire the flight recorder into the realtime path) so subsequent live rows are
observable. No live row returns to PROVEN without a real-device trace passing LIVE-DEVICE-TRACE-HARNESS.
