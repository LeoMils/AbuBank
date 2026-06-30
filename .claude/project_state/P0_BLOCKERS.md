# P0_BLOCKERS

## CODE P0: NONE OPEN
All code-solvable P0s from prior war rooms are fixed, tested, deployed (0.8.1).

## Non-code blockers (cannot be closed by code — documented per rules)
- **P0-DEVICE** (owner: Leo): Physical iPhone voice — mic capture + TTS *sound*
  (warm/natural) + on-device latency. NOT provable in code. Path: run
  `docs/abuai/LEO_COMPANION_BREAKTHROUGH_RETEST.md`. Mitigation: validated pipeline
  fallback + full diagnostics ([AbuAI][VOICE|LATENCY]).
- **P0-REALTIME** (owner: Leo/account): Realtime provider returns
  `REALTIME_PROVIDER_FAILED` (quota/key). Path: restore the OpenAI Realtime
  entitlement/key in Vercel env. Mitigation: silent pipeline fallback + 5-min skip
  window (no retry storm) — already production-safe.

## P1 (non-blocking)
- No automated lint gate (no eslint config). Build + test + typecheck are the gates.
- Branch not merged to main (deliberate; awaiting device sign-off).
