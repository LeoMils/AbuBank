# Realtime vertical slice — worklog

## Checkpoint 1 (b1e88fc)
- Implemented the deterministic **Control Plane** (STATE authority), 16 laws + mutation demos. 16/16.

## Checkpoint 2 (this commit)
- **Tool dispatch** (`realtimeTools.ts`): delegates every tool call to the deterministic kernel;
  maps status; NO completion status; refuses a phone number in args; scrubs a number label; idempotent
  (no duplicate handoff on retry). 9/9.
- **Streaming-truth monitor** (`truthMonitor.ts`): bounded detection of fabricated completion (always)
  + unsupported capability denial (vs a READY receipt); passes truthful preparation wording. 6/6.
- **Bug found + fixed (first-wrong-decision):** the completion patterns used JS `\b`, which is
  ASCII-only and NEVER matches at a Hebrew word boundary — so the monitor silently detected nothing
  (a dangerous false-green). The failing-first test caught it; patterns rewritten without `\b`.
  (This is the recurring Hebrew-`\b` mechanism already in the failure genome.)
- Created mission continuity artifacts (mission/evidence/failure-corpus/worklog).

## Checkpoint 3 (this commit) — S5a simulated-realtime seam + canonical card view-model
- **Session orchestrator** (`realtime/sessionOrchestrator.ts`): the headless composition of the three
  authorities — control plane (STATE) + tool dispatch→kernel (TRUTH) + truth monitor (SPEECH GUARD) —
  driven by INJECTED events (`acceptTurn` / `injectToolResult` / `injectInterruption` / `enterFallback`
  / `requestGreeting`). It threads revision+generation from REQUEST_TOOL → dispatchTool → correlated
  TOOL_RESULT so the card commits at the active revision and never late. Projects ONE canonical
  `ActiveActionViewModel` (§13) that the card + speech both read (law 9). This is the simulated-realtime
  seam: the ADR §18 journey is now provable WITHOUT a mic/WebRTC.
- **Production kernel adapter** (`realtime/kernelAdapter.ts`): the one prod binding of the dispatcher's
  injected `KernelFn` to the single Communication kernel authority (`buildCommunicationAction` +
  `detectWhatsAppTurn`) — the SAME reducer/recipient resolution the typed path uses, so the slice and the
  typed path can never fork into two truth owners. No number enters/leaves.
- **§18 falsifier test** (`sessionOrchestrator.test.ts`, 9/9): greeting-once; WhatsApp→atomic REPLACE to
  Call (kind+revision change, supersedes, exactly one card); MUTATION guard (replace-as-continue would
  keep message); stale-revision result rejected; complaint doesn't mutate; speech guard blocks fabricated
  completion + passes truthful preparation; fallback preserves the Call action + rejects a pre-fallback
  (stale-generation) result; no completion status representable; unresolved recipient → clarification, not a guessed handoff.
- Additive + unwired (same class as b1e88fc/683f3c1) → no product version bump; the bump ships with the
  wired+deployed operator-testable build (S5b, next).

## Checkpoint 4 (this commit) — S5b canonical card + flag-gated live harness + version bump
- **`ActiveActionCard`** (`src/components/ActiveActionCard.tsx`): the ONE canonical live card (§13), a pure
  projection of a committed `ActiveActionViewModel` — recipient label, committed status/a11y, the single
  primary control, `rev N`. Structurally cannot show a completion; never shows a number. Tested (renderToString)
  for message + call revisions incl. no-completion + not-configured (no button) + invisible→renders nothing.
- **`realtime2` slice flag** (`voiceModePreference.ts`): independent, OFF by default, `?voice=realtime2|slice`
  opt-in / `pipeline|off|0` clear; proven independent of the realtime BETA in both directions (14 flag tests).
- **`RealtimeSliceHarness`** (`realtime/RealtimeSliceHarness.tsx`): a self-contained, mic-free §18/§19 falsifier
  owning a real `SessionOrchestrator`; operator injects greeting → WhatsApp start → atomic REPLACE to Call →
  complaint (no mutation) → interruption → fallback, renders the `ActiveActionCard` + a privacy-safe state
  readout, and a speech-guard checker. Kernel modes: PRODUCTION (real `buildCommunicationAction`) or
  SIMULATED-READY (§19). Mounted in AbuAI/index.tsx behind `isRealtimeSliceEnabled()` (two gated lines;
  certified path untouched when off).
- **Version bump** 0.169.0 → **0.170.0-realtime-slice-harness-rc** (version.ts + api/health.ts + version.test.ts
  in sync — first WIRED, operator-testable build of the slice). Build green; typecheck 0.

## Checkpoint 5 (this commit) — S5c DEPLOYED falsification + RC alias + unknown-failure campaign
- **Preview deployed** (target=Preview, not prod): abu-bank-6hhfwyqb9-leos-projects-d3c04c09.vercel.app.
  `/api/health` → buildVersion `0.170.0-realtime-slice-harness-rc` = tested == pushed == deployed.
- **DEPLOYED §18 falsifier PASSED** (`e2e/realtime-slice-journey.spec.ts`, mobile-chrome, 9.2s) against the live
  Preview, NO mic: greeting-once → WhatsApp card (rev 1, message) → "לא, תתקשרי אליו" atomic REPLACE to Call
  (rev 2, kind flips, supersedes act_, active=1) → complaint does NOT mutate → speech guard BLOCKS "שלחתי" →
  the card never renders a completion. **BROWSER/PREVIEW evidence.**
- **Stable RC alias updated**: `abu-ela-rc.vercel.app` now serves `0.170.0` (verified via health) — Leo's canonical
  device-entry origin carries this build (slice OFF by default; certified path unchanged).
- **Independent unknown-failure campaign** (`sessionOrchestratorAdversarial.test.ts`, 9/9): replace-before-start,
  triple flip message→call→message, cancel-then-late-result, out-of-order seq, fallback↔reconnect churn, a phone
  number as recipient (scrubbed → NEEDS_CLARIFICATION), a throwing kernel (honest FAILED, no crash/fake success),
  EXPLICIT_SWITCH==atomic replace, interruption preserves the card. No unknown failure surfaced — generalizes
  beyond the supplied transcript.

## Checkpoint 6 (this commit) — S5-LIVE the ACTUAL WebRTC function-tool path (§12/§17-5)
- **Official contract verified** (developers.openai.com, 2026-08): session.tools + tool_choice; function call via
  response.function_call_arguments.done AND response.output_item.done / response.done (item type function_call,
  name/call_id/arguments); result via conversation.item.create(function_call_output); continue via response.create.
- **realtimeToolSchemas.ts** — the 4 comm tools (prepare_whatsapp/prepare_call/replace_active_action/
  cancel_active_action); privacy by construction (recipient is a NAME, no phone param, additionalProperties false).
- **realtimeFunctionBridge.ts** — pure parser for all three completion shapes; ignores audio/text/delta.
- **realtimeCommController.ts** — the LIVE production adapter: function_call → map turn → SessionOrchestrator
  (control plane + the ONE buildCommunicationAction kernel) → SAFE function_call_output (never a number/completion)
  + response.create → onCard(committed vm); guards the model transcript (fabricated completion / unsupported denial
  → truthful repair next turn + incident); idempotent by model call_id.
- **realtimeVoice.ts** — buildRealtimeSessionUpdate declares session.tools + tool_choice auto + create_response TRUE
  ONLY in slice mode (certified brain-driven config unchanged); RealtimeVoiceSession routes function-call events to
  the controller + runs the monitor on assistant_transcript_done; a minimal injectForTest seam exercises the REAL
  handleEvent/sendEvent path with no WebRTC.
- **index.tsx** — constructs the slice-enabled session behind isRealtimeSliceEnabled() && isRealtimeBetaEnabled()
  (double flag, OFF by default) and renders the canonical live ActiveActionCard from the committed view-model.
- **DEFECT FOUND + FIXED (campaign)**: the truth monitor over-blocked a NEGATED completion ("לא נשלח" = "won't be
  sent" — the receipt's own truthful note). Added negative-lookbehind + a failing-first regression. This is the
  ADR §16 over-blocking-firewall failure, surfaced by the live path.
- **Production-faithful proof** (`realtimeVoiceSlice.test.ts`): a REAL RealtimeVoiceSession instance, driven by
  injected real-shaped server events, proves card + safe function_call_output + response.create, atomic replace,
  transcript repair, and tools-only-in-slice config. Plus live controller + bridge + schema tests.
- Version 0.170.0 → **0.171.0-realtime-live-functiontool-rc** (version.ts+health+test synced). typecheck 0; build green.
- **Deployed re-falsification**: Preview abu-bank-pa93w1vin serves 0.171.0; the §18 harness falsifier PASSED
  against the RC alias abu-ela-rc.vercel.app (mobile-chrome, no mic, 8.2s). tested == pushed == deployed.
- **Post-implementation review (fresh eyes)** — one HONEST LIMITATION recorded (not a blocker for the automatable
  slice): in slice mode a mid-session realtime→pipeline FALLBACK reverts to the certified brain-driven path (which
  has no function tools), so the control-plane live card does not advance via tools after a fallback until the
  session ends (the certified fallback still produces its own CommunicationAction card via the brain). Unifying the
  fallback under the same control plane is ADR §17 stage 8 (out of this slice). No hidden second semantic authority,
  no duplicate card renderer (ActiveActionCard is shared), kernel never authors prose, model never certifies truth.

## Checkpoint 7 (this commit) — S1 false-completion audit + exactly-once dedup (Critical/High)
- **1.A handoff-target boundary AUDITED — CORRECT**: ActiveActionCard.onPrimary passes the safe NAME to
  adapter.buildHandoff, which resolves the number LOCALLY (resolveContactForName) and encodes the wa.me/tel URL;
  the number never reaches the provider. Proven by the adapter code + e2e/abuai-whatsapp-intent (wa.me/972…
  byte-for-byte, no auto-send). Not a defect.
- **1.C event dedup DEFECT FOUND + FIXED (Critical/High)**: the same model call can arrive in
  response.output_item.done AND response.done (and function_call_arguments.done); the controller re-sent a second
  function_call_output and had an async race that could double-invoke the kernel. Fixed with a synchronously-marked
  in-flight guard → EXACTLY ONE kernel call, one card, one function_call_output per call_id. Proven at the controller
  (race-safe concurrent test) AND on the real RealtimeVoiceSession path (dual-shape test). Updated the prior idempotency
  test (which encoded the re-send) to the corrected exactly-once contract — fixing the truth, not weakening a test.
- Created **production-scorecard.json** (immutable, evidence-classed) — honest status incl. GAP / EXTERNAL-BLOCKER /
  PHYSICAL-ONLY categories (Calendar migration, live baseline/tournament, Hebrew corpus, whole-product QA, device).
- Version 0.171.0 → **0.172.0-realtime-exactly-once-dedup-rc** (synced). typecheck 0; build green; FULL SUITE
  11938 passed / 0 failed. Deployed (abu-bank-7flyrapmj); RC alias abu-ela-rc.vercel.app → 0.172.0 (health verified);
  deployed §18 falsifier PASSED (7.7s). tested == pushed == deployed.
- **HONEST DENOMINATOR NOTE**: against the PRODUCTION-CANDIDATE denominator (see production-scorecard.json) the
  Communication LIVE path is proven to the automatable limit, but Calendar migration, general-conversation live
  measurement, Hebrew audio corpus, live latency baseline + config tournament, whole-product Critical/High QA, and
  physical iPhone validation are GAP / EXTERNAL-BLOCKER (headless env cannot run a live WebRTC audio session) /
  PHYSICAL-ONLY. NOT a full production candidate; not claimed.

## Status
- §18 vertical slice: **wired (flag-gated) + deployed (Preview) + falsified (deployed browser)** = the mission's
  COMPLETION terminal condition for THIS slice is met. **99 tests** (controlPlane 16 · realtimeTools 9 · truthMonitor
  6 · sessionOrchestrator 9 · adversarial 9 · ActiveActionCard 5 · slice-flag 14 · version 22 + the deployed e2e).
  Full suite 11906 passed / 0 failed; typecheck 0; build green; both commits pushed; RC alias updated.
- HONEST REMAINING (follow-on §17 stages 5–10, NOT claimed done): the ACTUAL live mic→function_call path is not
  yet driven by WebRTC — the session still runs create_response:false with the brain producing answers; the slice
  is proven through the injectable seam + deployed harness, not yet by a real mic turn. Rich calendar draft is
  out-of-slice. DEVICE mic naturalness/audibility remains physical-only per §20 — Leo-device confirmation only.
- Verdict: SLICE COMPLETE (deployed + falsified). Broader Realtime migration continues at §17 stage 5 (comm tools
  over the live WebRTC session) — no external blocker, no ADR contradiction.
