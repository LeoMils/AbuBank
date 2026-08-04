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

## Status
- Full slice proven: **81 tests** (controlPlane 16 · realtimeTools 9 · truthMonitor 6 · sessionOrchestrator 9 ·
  ActiveActionCard 5 · slice-flag 14 · version 22). Typecheck 0. Production build green. Full suite: <pending release gate>.
- REMAINING (S5c): deploy Preview, prove the §18 journey by clicking `?voice=realtime2` in the deployed browser
  (BROWSER/PREVIEW class), update the stable RC alias, then the independent unknown-failure campaign. DEVICE
  (mic naturalness/audibility) stays physical-only per §20 — not claimed.
- Verdict: NOT READY — deployed falsification remains (no external blocker, no ADR contradiction).
