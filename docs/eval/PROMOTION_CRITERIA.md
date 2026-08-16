# PROMOTION CRITERIA — every flag has a written criterion (Class B: a flag without one is a bug)

A flag that ships dark with no written promotion criterion is the failure that made the owner hear the
same problems every time (the preamble fix was built, tested, and OFF in the build he tested). Rule:
**every flag states, in one line, exactly what evidence promotes it to a code default.** The four
device-gated flags are machine-enforced by `assertDeviceGatedFlagIntegrity()` (build fails if a flag is
`promotionConfirmed:true` but ships OFF). This table is the human-readable index.

| Flag | Default | Kind | PROMOTION CRITERION (what flips it ON permanently) |
|---|---|---|---|
| `LIVE_AUDIO_TUNE_V2` | OFF (env) | device-gated | EAR_CHECK #2 — one clean voice, no echo, on the phone → set promotionConfirmed + code default ON |
| `LIVE_BARGE_IN_TRUNCATE` | OFF (env) | device-gated | EAR_CHECK #1+#3 — full sentence audible + she stops when spoken over; ships WITH audio-tune |
| `LIVE_PREFETCH_WARM` | OFF (env) | device-gated | EAR_CHECK — a cached cinema/weather answer feels fresh, not stale (freshness-vs-latency is an ear call) |
| `LIVE_PREAMBLE_TWO_RESPONSE` | OFF (env) | device-gated | EAR_CHECK #? — first words are the answer; the ~4s preamble gap is gone (currently ON in the EAR build) |
| `LIVE_CLASSIFIED_MONITOR` | OFF (env) | device-gated *(added this session — was the dark flag with no criterion)* | EAR_CHECK #4 — a repair redo does not make her stilted/slow; no method-narration heard |
| `LIVE_OUTPUT_MONITOR_REPAIR` | **ON** (code) | promoted | already ON — measured 0 FP on the hard deterministic set (language/source/literal); evidence in FLAG_AUDIT |
| `LIVE_INTERRUPT_RESPONSE` | OFF (code) | **permanent** | never promotes — OFF is the device-proven correct default (server auto-truncate on echo was the bug) |
| `ONLINE_GENERAL_SEARCH` | **ON** (code) | promoted | already ON — ONLINE_ACCEPTANCE measured never-worse-than-snippet |
| `ONLINE_PREFETCH_WARM` | OFF (code) | criterion = LIVE_PREFETCH_WARM's | same device freshness call |
| `ONLINE_PROVIDER` | 'openai'→'brave' (env) | config | a provider key present in the target env (brave/tavily set in Preview) |

## The rule going forward
- A new flag is not merged without a row here AND (if device-gated) an entry in `deviceGatedFlags.ts`
  with an `earCheck`. The device-gated integrity assertion then guarantees it can never be
  ear-confirmed-yet-shipping-OFF.
- `/build-flags.json` reports the EFFECTIVE state of every flag in the deployed build, so "which fixes
  are live" is always machine-verifiable from the URL.
