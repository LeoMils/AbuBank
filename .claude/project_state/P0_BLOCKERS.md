# P0_BLOCKERS

## CODE P0: NONE OPEN
All code-solvable P0s from prior war rooms are fixed, tested, deployed (0.8.1).

## Non-code blockers (cannot be closed by code — documented per rules)
- **P0-DEVICE** (owner: Leo): Physical iPhone voice — mic capture + TTS *sound*
  (warm/natural) + on-device latency. NOT provable in code. Path: run
  `docs/abuai/LEO_COMPANION_BREAKTHROUGH_RETEST.md`. Mitigation: validated pipeline
  fallback + full diagnostics ([AbuAI][VOICE|LATENCY]).
- **P0-REALTIME** (root cause FOUND + minting layer PROVEN, 0.46.0): the old
  `/v1/realtime/sessions` + `gpt-4o-realtime-preview` were **deprecated → HTTP 404**,
  NOT a quota/key problem (key is present). Fixed to the 2026 contract
  (`/v1/realtime/client_secrets`, model `gpt-realtime`, session-wrapped body,
  token at `data.value`; SDP → `/v1/realtime/calls`). The ephemeral token now
  **mints `ok=true` server-side on the preview** (404→400→200, HIGH evidence via
  `POST /api/realtime-token`). REMAINING (owner: Leo, device-only): the browser
  WebRTC + mic + audio loop cannot be verified without a physical device/browser
  session. If it still fails on device, the Product Truth panel now shows
  `REALTIME_STATUS=fallback / FALLBACK_USED=YES` honestly (no more silent drop).

## P1 (non-blocking)
- No automated lint gate (no eslint config). Build + test + typecheck are the gates.
- Branch not merged to main (deliberate; awaiting device sign-off).
