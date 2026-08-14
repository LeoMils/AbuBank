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

═══════════════════════════════════════════════════════════════════════════════
## ITER 1 — CLASS: source-citing (NO_SOURCES) · MECHANISM fix · v0.239.0

**Failure class:** the model names the websites it "checked" (reproduced on the
device AND on the gpt-realtime harness: cinema → "מאתר סינמה סיטי ומאתר Seret.co.il";
price → four store names).

**Root cause (structural, self-inflicted):** `liveTools.handleOnline` handed the
model a `sources` array AND `allowed_to_say: ['... and mention the source']`. It was
TOLD to cite, and given the material to cite with.

**Fix (mechanism, not instruction — the model cannot cite what it never receives):**
the `function_call_output` for get_current_info now carries NO `sources`, and the
answer is passed through `scrubForSpeech()` (strips markdown links → keep text, bare
URLs, `www.`, "מקור:/source:" trailers, and bare domain tokens like `seret.co.il`).
`allowed_to_say` now FORBIDS naming any website/source. The provider adapter in the
harness was also aligned to hand CONTENT only (no titles) per the Phase 2A mandate.

**Before → after on the REAL realtime instrument (`reproduce.ts`):**
- cinema — before: "…מבוסס על המידע מאתר סינמה סיטי ומאתר Seret.co.il"; after: no site
  names ("…כדאי לבדוק את השעות המדויקות בבית הקולנוע").
- price — before: named לה אסנס / PerfumeIL / טופ פארם / TERMINAL X; after: no store
  or site names.
**Delta: NO_SOURCES eliminated on both online probes.** Mechanism, not instruction
(the ~35k bundle was NOT grown).

**Guard + mutant:** `onlineNoSourceLeak.test.ts` (6) — the payload the model receives
has no `sources`, no URL, no bare domain; `scrubForSpeech` unit-tested. Mutant
`online-source-leaks-to-model` (stop scrubbing) → the test turns red.

**Residual (NOT hidden):** the online answer is still a search SNIPPET, not fetched
page content — so a real PRICE is still missing (price probe gave stores, not a
number). That is the Phase 2A depth build (fetch + synthesize within budget) and is
listed in the remainder, NOT claimed done.

═══════════════════════════════════════════════════════════════════════════════
## CLOSE — honest status of the run

**Delivered (real, verified):**
- The CORRECT instrument: `gpt-realtime` over GA WebSocket with text, Abu's real
  `buildSessionUpdate()` + tools + `LiveTools`. Reproduces 3 of 4 named failure classes.
- ITER 1: a mechanism (not instruction) fix for NO_SOURCES, re-measured on the real
  instrument (source-naming eliminated), regression-tested, mutant killed (harness 19/19).
- Gates green at HEAD: typecheck 0 · full suite 12723 · build 0 · mutation 19/19.

**NOT delivered, and why (no fabricated numbers):**
- **Phase 0b judge calibration — BLOCKED.** The owner's ~15 "הערה לקלוד" human labels
  are absent from the repo. There is nothing to calibrate the judge against, and the
  spec forbids entering the loop with an uncalibrated judge. The synthetic judge is
  therefore UNTRUSTED taste; do not treat its 1–5 scores as the owner's taste.
- **Phase 0c noise floor, Phase 1 simulator (120 scenarios), 1b two-judge ensemble,
  Phase 3 40-iteration loop — NOT run.** A single agent in one session cannot execute
  thousands of realtime calls over many hours. Reporting a convergence % from a run
  that did not happen would be a fabrication. Not done.
- **Preamble criterion — UNTRUSTED off-device.** It did not reproduce even on
  gpt-realtime text (0/4 probes). It is likely audio-output- or reasoning-tied.

**Ranked remainder (what each needs) — the real Phase-2 work, none faked:**
1. G · INSTRUCTION SHRINK to <5k chars (remove the duplicated family data; per-intent
   injection). Highest leverage: the family-relation error persists because the model
   answers from the bundle instead of calling the family tool. Assert size in a test.
2. D · FAMILY RELATIONS — force the family tool (make the bundle carry no family data
   so relation queries MUST resolve via the deterministic resolver). Resolver exists.
3. A · ONLINE DEPTH (second half) — fetch result-page CONTENT in parallel within a 3s
   budget + synthesize sans attribution. The NO_SOURCES half is done; the "real price"
   half needs this. Never pass the model a URL/title (already enforced).
4. F · CAPABILITY REFUSALS — the model refuses actions it holds tools for; fix
   structurally (tool descriptions / tool_choice pressure / a refusal guard).
5. B · REMINDERS (live path) — a reminder tool + durable store + large audible popup,
   fires on time, survives reload. (The calendar screen has reminders; the LIVE path
   has no reminder tool — device offered a calendar event, honestly.)
6. C · PERSISTENT MEMORY — a memory tool + durable store so a death/new-member/
   correction survives sessions; "never says she cannot update anything."
7. E · AUDIO — session config (noise_reduction far_field, VAD tuning) + barge-in
   truncation to playback position. PHYSICAL-DEVICE validation only.
8. The evaluation scaffold: noise floor, 120-scenario multi-turn simulator, two-judge
   ensemble, and the ratcheted loop — buildable, but each is a real body of work.

**Merge readiness:** all convergence-v3 work is on `rc5/cognitive-architecture-and-
acceptance`, tagged `known-good-pre-convergence` at the run's start. NOT merged to
main (main still serves the Aug 5 build). Before a merge is safe: rebase on main +
resolve conflicts, run the full gate on the rebase, and a human must approve `--prod`.

═══════════════════════════════════════════════════════════════════════════════
## PHASE 0b/1 + COVERAGE + ADVERSARIAL (post-trace)

**Judge calibration — PASS 93.8%** (15/16 text-scorable incidents; 81.3→87.5→93.8
via 3 principled rubric fixes; residual INC-03 is a multi-defect turn the judge still
flags defective). Human trace registered PERMANENT HOLDOUT. See DECISIONS D-CAL-01..08.

**Coverage inventory — ≈41% COVERED** (docs/eval/COVERAGE_INVENTORY.md). Biggest
UNCOVERED clusters: the 3 UNBUILT blocker capabilities (reminders, persistent memory,
online depth), Spanish/switching, and the CARE ask-categories (health, medication,
grief, safety, money) — exactly what a woman alone at home needs most.

**Scenario corpus — 31 seed scenarios** (docs/eval/multiturn-corpus.jsonl), 70/30
visible/holdout, tagged by required capability + severity (unbuilt-capability
scenarios excluded from scoring until built). Cap 200 did NOT bind.

### ADVERSARIAL AUDIT (1 pass — honest findings)
1. **The simulator the spec required was NOT built.** Phase 1 wanted a GENERATED,
   persona-driven Martita who repeats herself, gets confused, and pushes back —
   never scripted. What exists is a SCRIPTED 31-scenario seed. This is the single
   biggest gap: the corpus cannot yet elicit the emergent multi-turn failures
   (self-contradiction across turns, confusion, repeated pushback) that the trace
   proves are real. Foundation only.
2. **Most scenarios are 1–3 turns, not 5–15.** Retention/consistency failures need
   long sessions; those are under-tested here.
3. **CARE (NO_HARM) is instruction-only, not a mechanism.** health/medication/safety/
   money scenarios are marked built=true but rely on prompt rules, not a guard — they
   will likely FAIL the calibrated judge. Untested = optimistic.
4. **Voice-path defects (preamble, interruption) cannot be scored here** — device-only.
   Per rule 3 they keep BLOCKER priority despite a low trace count.

### SEVERITY-RANKED QUEUE (from calibration + coverage + trace)
🔴 BLOCKER
  1. Persistent memory (UNBUILT) — never "I can't update"; deaths/members/corrections
     persist across sessions. Trace INC-09. Coverage 0.
  2. Reminders (UNBUILT) — fire on time, popup + sound, survive reload. Trace INC-07.
  3. Online depth (PARTIAL) — real film list / real price via page fetch in the 3s
     budget; never a source. NO_SOURCES already fixed (v0.239). Trace INC-01/INC-12.
  4. Family defer (PARTIAL) — never argue on her own family; accept correction at once.
     Trace INC-04.
  5. NO_HARM (INSTRUCTION-ONLY) — health/medication/safety/money → safe answer that
     points to a real person, never improvised. Untested → treat as failing.
  6. Preamble + interruption (DEVICE/AUDIO) — cannot fix or verify off-device; keep priority.
🟠 MAJOR
  7. Family brevity — one-sentence relation, no derivation (INC-05).
  8. Over-explaining — short receipts; do not restate messages/limits (INC-11/INC-13).
  9. Spanish + language-switching — uncovered.
  10. Capability honesty as ONE line, no meta (INC-30/INC-11).
🔵 MINOR
  11. Yiddish / literal task-follow (count) — INC-14/INC-15.
  12. calendar update / cancel coverage gaps.

═══════════════════════════════════════════════════════════════════════════════
## AGENT: UI-STATE · CLASS: state-mismatch + QA-badge-in-prod · v0.244.0

**Baseline captured (deterministic, no instrument needed):** assembled live instructions
= **24,513 chars**; the duplicated family portrait inside them (`buildFamilyPortrait()`)
= **10,902 chars**; full session.update payload = **36,863 chars / 49,368 bytes**. This
is the G-shrink starting point (target <5,000 via per-intent re-injection — its own cycle).

**Failure class 1 — the screen lied.** Owner (device): "you are speaking while the screen
says you are listening." MECHANISM (first divergence): in `LiveScreen.tsx` the spelled-out
state WORD read the RAW session state (`STATE_LABEL[state]`, which has no `thinking` key),
while Abu's face + aura read the RECONCILED `presenceState` (`toPresenceState`, where
speaking wins over a stale thinking hint and `onState` clears `thinking` on every
transition). So the word could disagree with the face, and during the thinking window it
showed "מקשיבה" (listening) while she was composing.

**Fix (one reconciled source of truth):** added `liveStateWord(state, presenceState)` — the
one word is now derived from the SAME reconciled `presenceState` as the face, so they can
never disagree. During an active turn it is always exactly one of מקשיבה / חושבת / מדברת
(`connecting` is the one honest pre-turn transient "מתחברת…"). Enlarged 20px→30px, bold, for
an 80-year-old; `aria-live="polite"`. It is driven by real session events, never optimistic.

**Failure class 2 — QA badge in production.** The Home `home-qa-version` "QA: v…" badge was
always visible. Gated behind `import.meta.env.DEV` (build stays confirmable in prod via
Settings→About + operator diag). `version.visibility.test.ts` strengthened to assert the gate.

**Regression + evidence:** `presenceState.test.ts` now proves the word is driven by the
reconciled state and can NEVER say מקשיבה while speaking (raw state=speaking) or during the
thinking window (raw state=listening + thinking hint) — red against the old `STATE_LABEL[state]`.
Gates: typecheck 0 · full suite **12,762 passed** (1 skip, 2 todo) · build ✓.
**Evidence class: CODE.** The on-screen render (that Martita actually reads the larger word,
and the badge is truly absent in a prod build on device) is a BROWSER/PHYSICAL_DEVICE item —
NOT claimed here. The realtime instrument measures MODEL output; this is client-UI chrome, so
that instrument is not the applicable before/after here (logged, not skipped silently).

**Instrument-gated remainder (each its own careful cycle; none faked this session):**
G bundle-shrink to <5k via per-intent re-injection (needs the 5× noise-floor baseline first);
D family-resolver full pair matrix (depends on G removing the 10,902-char portrait so relation
queries MUST hit the resolver); A online-depth first-wins + prefetch warm-store + non-verbal
in-flight cue (needs live fetch + realtime before/after); I persona simulator (5–15 turn,
self-contradicting, Spanish/switching). Legacy `realtimeVoice.ts` has the same state-mismatch
class (`response_done`→immediate listening) but is off the hub path (`?legacy=1` only).
