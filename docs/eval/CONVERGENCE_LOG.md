# CONVERGENCE LOG — autonomous run v3

Branch: `rc5/cognitive-architecture-and-acceptance`. HEAD tagged
`known-good-pre-convergence`. Never merged to main.

Format per iteration: what · scores · failure CLASS attacked · change · delta ·
mechanism-or-instruction.

═══════════════════════════════════════════════════════════════════════════════
## PHASE 0 — THE INSTRUMENT (rebuilt to drive the ACTUAL realtime model)

**Built** `scripts/eval/realtimeRunner.ts` + `scripts/eval/reproduce.ts`: drives
`gpt-realtime` over its **GA WebSocket** with TEXT input, using Abu's OWN
`buildSessionUpdate()` instructions + tool schemas + the real `LiveTools` executor
(online wired to live Brave). Captures per turn: text, tool calls, any text emitted
BEFORE a tool result, time-to-first-token, total latency.

**Two GA obstacles found + resolved:**
- The Beta API shape is disabled ("beta_api_shape_disabled"). Fixed: GA `/v1/realtime`,
  no `OpenAI-Beta` header, `type:'realtime'` + `output_modalities:['text']`.
- `reasoning:{effort:'low'}` is **"Unsupported option for this model"** on the GA WS.
  Dropped it (binary-searched: instructions + all tools are accepted; only `reasoning`
  is rejected). **Fidelity gap, reported:** the device session carries reasoning effort;
  the GA text harness cannot. Also output is TEXT, not audio.

### REPRODUCTION GATE — result: PARTIAL (3 of 4 failure classes reproduced)
Owner's real desktop trace is **absent from the repo** (grep for "הערה לקלוד" / the
transcript / "Bleu de Chanel" = 0 hits), so the four exchanges were **reconstructed
from their descriptions**, not replayed verbatim, and there are no human labels.

| probe | observed on gpt-realtime (text) | described failure | reproduced? |
|---|---|---|---|
| cinema `איזה סרטים רצים בכפר סבא` | gave titles BUT cited "מאתר סינמה סיטי ומאתר Seret.co.il" | source-citing / snippets | ✅ YES (NO_SOURCES) |
| price `כמה עולה בלו דה שאנל` | **no price** — listed stores + "check the sites" | snippet not a price | ✅ YES |
| relation `מה הקשר בין עדי ללאו` | "עדי הוא הבן של לאו" invented, **no family tool call** | relationship error | ✅ YES |
| reminder `תזכירי לי בעוד דקה` | honest: no timer, offered a calendar event | no reminder capability | ⚠️ capability absent, handled honestly |
| **preamble** (announce-before-tool) | `preTool=false` on all 4 | "before every tool call" live | ❌ **NOT reproduced** |

**Honest verdict on the instrument:** it is the correct model + real bundle + real
tools, and it reproduces source-citing, no-real-answer/depth, and family-relation
error — three of the run's headline defects, which the gpt-4o chat harness could
partly show but not faithfully. **It did NOT reproduce the announce-before-tool
preamble** even on gpt-realtime in text mode. Candidate causes (unproven): the
preamble is tied to AUDIO output, or to the dropped `reasoning` config, or to
longer multi-turn context. Per the addendum's fallback, PREAMBLE_FREE measured on
this harness is therefore **NOT trustworthy** for the device; it must be validated
on a physical device with audio.

═══════════════════════════════════════════════════════════════════════════════
## BLOCKERS that stop the run as literally specified (reported, not worked around)

1. **The owner's desktop session trace does not exist in this repo.** Grep across
   all md/json/jsonl/txt for the "הערה לקלוד" annotations, the transcript, or the
   named exchanges returns nothing. Consequences:
   - **Phase 0b (judge calibration)** — cannot measure judge↔human agreement; there
     are no ~15 human labels to score against. The judge is therefore UNCALIBRATED.
     Per the spec, "do not enter the loop with an uncalibrated judge." Honored.
   - **Reproduction gate** — reconstructed intents, not verbatim exchanges.
   - **Permanent-holdout human trace** — nothing to hold out or score separately.
   The single most load-bearing artifact of this run is missing; several phases are
   ground-truth-less until the owner provides the trace + annotations.

2. **A 40-iteration overnight convergence loop is not executable by a single agent
   in one bounded session.** The spec describes 120+ multi-turn scenarios × a
   two-judge ensemble × the realtime WS × up to 40 iterations × 7 parallel building
   agents — thousands of realtime calls over many hours. Faking that progress would
   violate this codebase's core rule ("never report a number from the wrong model as
   if it measured Abu"; "NO TOOL RESULT = NO CLAIM"). Not attempted as fiction.

**Decision (per addendum item 3):** deliver the correct instrument + an honest
reproduction report, make the highest-leverage STRUCTURAL fix the instrument proved
(and that is model-independent), re-measure it on the real instrument, and hand back
a precise ranked remainder — rather than grind a fabricated loop.
