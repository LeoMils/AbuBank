# AbuAI No-Bypass Final Audit

**Build:** `0.15.0-cognitive-os` · **Date:** 2026-07-02 · **Verdict: HOLD** (default path still legacy; flag not device-verified).

## The mechanism

A single async entry — `runtimeFullTurn.runFullTurn` — now produces the FINAL display + speech for **any** input: deterministic domains are answered by `runCognitiveTurn`; LLM/online are executed via **injected tools** and forced back through `finalizeExternalAnswer` (verify + compose); the **Cognitive Supervisor** gates the result (repair once, else honest limitation); the **Conversation Delivery Engine** plans speech chunks. This is unit-proven (`runtimeFullTurn.test.ts`, `fullThinkingRuntimeReplay.test.ts`): **no raw tool text can reach output** — a broken-Hebrew LLM answer is caught and replaced.

`handleSend` calls `runFullTurn` behind **`VITE_ABUAI_COGNITIVE_RUNTIME_V2_FULL === 'true'`**. When on, the flagged branch returns before ANY legacy path runs → no legacy final answer is emitted.

## Path-by-path

| Path | File:line | Default (flag off) | Flag ON | Proof |
|---|---|---|---|---|
| text handleSend | index.tsx ~510 | legacy cascade (date/search/audio/frustration/read/family already on runtime) | **runFullTurn only** — returns before legacy | `runtimeFullTurn.test.ts` (12), `fullThinkingRuntimeReplay.test.ts` (17) |
| voice handleText | index.tsx 1408–1928 | **legacy** (untouched) | **legacy** (not yet wired) | — |
| calendar create/confirm/save | runtime | on runtime under flag (narrative Ofir now understood + saved) | ✓ | replay `create`, `ofir` |
| calendar read/search | runtime | on runtime (default too) | ✓ | replay `read`, `search` |
| calendar update/delete/reminders/recurring | legacy | **still legacy domains** (runtime lacks these reasoners) | routed through runFullTurn but mis-domained | gap noted below |
| family | runtime (directional engine) | ✓ | ✓ | replay `fam:*` |
| online | runtime tool (bridge, guarded) | on runtime under flag | ✓ | replay `cinema`, `worldcup` |
| general knowledge | runtime LLM tool → finalized | on runtime under flag | ✓ | replay `general`, `brokenheb` |
| emotional/frustration | runtime | ✓ | ✓ | replay `frustration` |
| audio complaint | runtime | ✓ (never cancels) | ✓ | replay `audio` |
| continuation/memory | runtime | ✓ | ✓ | replay `continue`, `memory` |
| TTS/spoken | delivery engine | chunk + resume + events | ✓ | delivery tests |

## Honest gaps (why HOLD)

1. **Flag defaults OFF.** Flipping it on for real users needs physical-device verification, which cannot be done from this environment. The mission says "final preview must run with full runtime enabled" — that requires a deploy + device, both Leo-gated.
2. **Voice handler is NOT wired to the runtime** even under the flag — it remains the legacy second copy. So voice still bypasses.
3. **Reminders / recurring / delete / update are not yet runtime domains.** Under the flag they still route through `runFullTurn` (so no raw bypass) but land in the wrong domain (create/general) — a coverage gap, not a bypass.
4. **`handleSend` itself is not unit-tested** (React), so the flag wiring is verified by typecheck + build + inspection; the `runFullTurn` engine it calls is fully unit-proven.

**Per the mission's own rule** ("if any path can still emit final text outside runtime → HOLD"): the voice path can, and the default text path does. **VERDICT = HOLD.**
