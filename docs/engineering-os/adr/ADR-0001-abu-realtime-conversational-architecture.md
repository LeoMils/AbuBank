# ADR-0001 — Abu AI Realtime Conversational Architecture (CERTIFIED)

- **Status:** CERTIFIED — decision-ready. ADR only; no implementation.
- **Date:** 2026-08-04
- **Decision:** **Option F — Grounded Realtime Agent on an Event-Driven Control Plane (GRA-EDC).**
- **Process:** hostile falsification → integrated correction → fresh certification; baseline verified against repo + current OpenAI docs. Preliminary "Option D/hybrid" wording removed; Option F is the sole design.

---

## 1. Product objective
One natural, intelligent, continuous Hebrew conversation approaching modern ChatGPT Live *as far as available developer tech allows*, while preserving absolute product truth, deterministic + visible in-session actions, privacy, reliable fallback and automated QA. Honest ceiling: full-duplex Hebrew audio, barge-in, in-session tools, coherent context and natural prosody are achievable; largest-model intelligence parity, perfect noisy-mic Hebrew STT, and zero-latency tool round-trips are not; felt naturalness is device-certified only.

## 2. Three disjoint authorities (the architecture)
- **MODEL owns TALK** — `gpt-realtime` (WebRTC): dialogue, pacing, clarification, barge-in, decide-to-call-a-tool. **Never authors product facts or actions.**
- **CONTROL PLANE owns STATE** (new, deterministic, non-semantic) — a small typed reducer + event log: turn-type contract, active-action lifecycle, monotonic branch revisions, playback-truth cursor, correlation IDs, greeting lifecycle, realtime⇄fallback switch, latest-intent-wins. It does **not** classify meaning or pick actions.
- **KERNEL owns TRUTH+ACTION** — `reduceGoal`/`validateResponse` + tools: action selection/replacement, recipient/relationship resolution, personal/calendar facts, tool execution, status, receipts. Tools **delegate** here; never decide.
- **TRUTH ENFORCEMENT** (see §11) — typed path: hard synchronous `validateResponse` gate. Voice path: **structural avoidance** (model has no fact source; product facts/completion enter ONLY via tool receipts; model instructed to defer all fact/capability/completion claims and to *never* claim completion) + **post-hoc transcript monitor** (detect → repair next turn → eval). UI is a projection of committed state, never an owner.

```
audio ─► [MODEL: talk, gated by instructions] ─┬─ function_call(name+intent, NEVER a number)
   ▲                                            ▼
   │ receipt-authored fact speech      [CONTROL PLANE: state/revisions/clocks/events]
   │                                            ▼ active-action(rev)
[monitor/repair]                        [KERNEL: reduceGoal + tools → receipts] ─► [LIVE CARD ⟵ same rev]
```

## 3. Baseline verification (repo + current OpenAI docs)
| Claim | Status |
|---|---|
| Realtime WebRTC transport + `client_secrets` mint + `gpt-realtime(-2.1)` + anti-drift | VERIFIED |
| Full-duplex/VAD/barge-in config in `buildRealtimeSessionUpdate` | VERIFIED |
| `reduceGoal`/`decideCommunicationTurn` single semantic authority; pure reducer w/ correction+replacement (`applyFollowUp`,`isFollowUpCorrection`,"לא פגישה"/"לא, למור") | VERIFIED |
| `validateResponse`/`renderResponse` reach the **voice** path | **FALSE** — only `capability.ts` (typed/pipeline). Voice speaks directly from `instructions`. → firewall redesigned (§11) |
| Calendar draft rich (participants/relationship/duration/location) | **FALSE** — `CreateDraft{title,date,time,emoji}` only. → rich `CalDraft` required |
| "Four clocks / latest-intent / event-driven control plane" implemented | **FALSE (documented only)** in parity rules → must be BUILT, and REDUCED (§8) |
| Realtime API supports session/response **function tools** (client executes, returns result) | VERIFIED (docs, 2026-08-04) |
| Tools exposed to the live session / in-session action card | FALSE (absent) → net-new |
| Scattered implicit "pending" state; no event log/revisions | VERIFIED → control plane is genuinely new |

## 4. Failure → first-wrong-decision → owner → root cause → required property (condensed)
1. Fact hallucination → model asserts unsourced fact → model/no grounding on voice → **facts only via receipts + monitor**. 2. Stale WhatsApp swallows later Call → pending owns next turn → implicit state → **turn contract + latest-intent-wins**. 3. "Call not message" fails → replace treated as continue → kernel boundary → **REPLACE is first-class**. 4. Complaint→clarification → misclassified → turn classifier → **ASK/meta exits clarify**. 5. Repeated greeting → fired on restart → UI side-effect → **greeting = control-plane event, session-start only**. 6. Robotic loops → templates own wording → **delete templates; model wording gated**. 7. Card invisible in live → no session↔card binding → **UI subscribes to active-action state**. 8. "brother of Mor"→Leo → coerces unresolved ref → resolver → **unresolved stays structural; ask; never invent an edge**. 9. Calendar correction loses fields → draft too thin → **rich field-level draft**. 10. Capability denied → model prose says "can't" → **capability from kernel; model never denies a supported action**. 11. General talk captured → routed into open action → **general never consumed by pending**. 12. Low-confidence→irrelevant clarify → no relevance gate → **one relevant clarification**. 13. Action truth≠UI → two representations → **one committed revision read by both**. 14. Naturalness/latency → chained pipeline can't full-duplex → **realtime transport (present) + device tuning (physical)**.

## 5. Component necessity (smallest architecture)
Model (natural talk — required), Control Plane (state/ordering/greeting/fallback — required; nothing else owns it), Kernel (truth/action — preserve), Truth enforcement (required — see §11 for the minimal enforceable form), active-action state (required — kills 2/7/13), tools (required delegation seam), live card (required — kills 7/13), memory layers (required, bounded — §10), reduced clock model (required minimum — §8), eval system (required). **Deleted as unnecessary:** per-turn planner, multi-agent, separate voice/typed semantic paths, template generator, phrase regexes. No component without a unique concrete responsibility survives.

## 6. Authority certificate (every material decision has exactly one authority; UI/transport never own)
MODEL: natural wording, clarification wording, decide-to-tool. CONTROL PLANE: session start/end, transcript accept/reject, turn-type, active-action lifecycle, topic, greeting, interruption ordering, stale/late-result handling, fallback/reconnect, summarization trigger, recovery. KERNEL: action select/continue/correct/replace/cancel, explicit domain switch decision, recipient + relationship resolution, calendar draft mutation, fact retrieval, capability truth, tool validation/execution, action status. UI: card projection only. **Forbidden writers** enforced by an architecture-contract test per row; **failure-if-duplicated** = the exact bug it prevents; **automated proof** = a contract/reducer test. Certification law: no decision with zero or >1 authority, none hidden in UI/transport, none as prose.

## 7. reduceGoal verdict
**PRESERVE AND NARROW.** Keep it as the pure action reducer (select/correct/replace/recipient-state) callable from tool adapters and from the typed path (parity). NARROW: turn-type *classification* moves to the Control Plane; it owns no general conversation and no wording. This is the smallest deterministic component the architecture would build anyway; replacing it would recreate risk. `validateResponse` preserved as the typed hard gate and the voice monitor's rule source.

## 8. Clock-model verdict — REDUCE four clocks → three primitives
Four named clocks over-abstracts. Minimum defensible model: **(a) monotonic branch REVISION** (latest-intent-wins, replaced/cancelled branches can't speak late); **(b) PLAYBACK cursor** (what was actually heard → truncation truth on barge-in); **(c) lifecycle CORRELATION IDs** (session/turn/action/tool). These solve barge-in, late playback, tool-after-replacement, repeated-greeting, stale timeout, reconnect/fallback disagreement. "Clock" = ordering+ownership, not wall-time. ADR mandates (a)+(b)+(c), not four literal clocks.

## 9. Event/race contract — minimal typed reducer + append-only event log (no generic framework)
Retained events (producer→consumers, typed payload w/ session/turn/action/tool IDs + revision, idempotent): SESSION_STARTED/ENDED, USER_AUDIO_STARTED/ENDED, TRANSCRIPT_FINAL/REJECTED, MODEL_RESPONSE_STARTED/COMPLETED/INTERRUPTED, TOOL_REQUESTED/RESULT/FAILED, ACTION_CREATED/UPDATED/REPLACED/CANCELLED/EXPIRED, CARD_COMMITTED/DISMISSED, TRANSPORT_DISCONNECTED/RECONNECTED, FALLBACK_ENTERED/EXITED, CONTEXT_SUMMARIZED, ERROR_RAISED/RECOVERY_COMPLETED. (Dropped as redundant: TRANSCRIPT_INTERIM as an owned event, TOOL_ACCEPTED/REJECTED separate from REQUESTED/RESULT, CONTEXT_PRUNED separate from SUMMARIZED — folded.) **Race laws (each a reducer test):** (1) latest accepted explicit intent wins; (2) replaced/cancelled branches never speak/render late; (3) interruption stops playback, keeps accepted input; (4) late tool result ignored unless correlated to the active committed branch; (5) reconnect never re-greets/duplicates an action; (6) fallback invalidates incompatible late realtime events; (7) UI+speech read the same committed revision; (8) one visible active action unless a proven requirement says otherwise; (9) failure/retry cannot duplicate an external handoff (idempotency key on handoff); (10) summary/pruning cannot override a newer correction. Highest-risk interleavings (barge-in during tool result; replace during execution; disconnect mid-tool) have explicit transition tables in the implementation contract.

## 10. Memory/context contract (explicit, privacy-safe)
Layers + owner + provider-visibility + budget + retention: A raw event log (control plane; local; session; deleted on end). B turn history (control plane; local; bounded). C working memory/topic (control plane; local). D active action/draft (kernel; local; **only name+intent ever leave the device**). E grounded fact set (kernel; from receipts; local). F tool receipts (kernel; local). G long-session summary (control plane; local; triggered by budget; a newer correction always overrides the summary — law 10; summaries eval'd against omission/distortion). H long-term memory: **only the existing memory system**, no new platform. Provider (model context) receives: general conversation + tool outputs (name/intent/fact strings) — **never a phone number, never raw contacts/photos**. Fallback inherits A–F by shared reference; reconnect rebuilds model context from B+E+D; long-session degradation detected by a summary-fidelity grader.

## 11. Truth-firewall feasibility — CERTIFIED with an honest asymmetry
A speech-to-speech model cannot be given a synchronous pre-utterance text gate. Selected mechanism = **#5 constrained-generation + bounded post-validation**, realized as:
- **Structural avoidance (primary):** the model is given **no local product-fact source**; identity/relationship/channel/calendar/capability/readiness facts enter the conversation **only** as tool receipts; the instruction forbids stating any such fact not present in a receipt.
- **Completion is structurally ungroundable:** Abu never auto-sends/dials, so there is no "sent/called" fact; the kernel only ever returns READY/HANDOFF_OPENED; the model is instructed to say only "מכינה/פותחת", never "שלחתי/התקשרתי".
- **Receipt-authored fact speech:** fact/action turns are grounded in the tool output the model reads back; general conversation streams freely (no product facts).
- **Post-hoc monitor (bounded):** a small typed detector over the final transcript (bounded product-fact schema — **not** open Hebrew regex, **not** a second untrusted model as the sole gate) flags any un-provenanced fact/completion → repair on the next turn + permanent eval.
**Honest limitation (recorded, not hidden):** typed path = hard gate (0 leaks by construction); voice path = structural + monitored (a paraphrase leak is possible but has no source to draw from, is instruction-forbidden, and is detected/repaired) — the strongest available with speech-to-speech. Acceptance (§ below) sets voice grounding = 0 leaks across the corpus + 100% completion-claim suppression. This is a REVISION, not a rejection.

## 12. Tool contract (delegating; none decides an action)
`prepare_call`, `prepare_whatsapp`, `replace_active_action`, `cancel_active_action`, `resolve_contact`, `resolve_relationship`, `calendar_create_or_update_draft`, `calendar_read`, `calendar_commit`, `query_capability`. Each: args = **name/intent/fields only (never a number)**; number resolved locally in the kernel; validation + kernel call + typed receipt + idempotency key. Concurrency: one active action; a second START supersedes via revision (law 1); replace-during-execution cancels the in-flight branch; fallback-during-execution preserves the branch; retry uses the idempotency key (no duplicate card/handoff). Returns to model: safe receipt strings only.

## 13. Canonical live UI (one `ActiveActionViewModel`)
Fields: cardId, revision, type, safe recipient label, safe draft preview, status, controls, correlationIds, provenance, a11y announcement, visibility, expiry. Proven invariants: UI+speech read the same committed revision (law 7); replace is atomic; stale cards never reappear; exactly one card; controls usable while voice continues; enlarged-text + iPhone safe areas; fallback/reconnect preserve or honestly clear; Send/dial manual; voice verbs act only on the visible committed card. Ambiguity: "פתחי/שני/בטלי/תתקשרי במקום" bind to the current committed card; if none, the model asks one question.

## 14. Latency/interruption invariants (automated vs physical split)
Pipeline mic→VAD→model→tool→kernel→commit→card→grounded speech→playback→interruption: each segment has an owner + observable timestamp. Automatable invariants: no unexplained silent wait; card appears **before/with** its truthful spoken confirmation; interruption stops obsolete playback (law 2/3); late responses can't follow a corrected intent (law 1); tool latency can't emit a second stale response (law 4); fallback is visible and continuous. Physical-only: Hebrew barge-in feel, endpointing quality, perceived latency.

## 15. Fallback/reconnect certificate
Shared state (sessionId, committed turns, working memory, active action, grounded facts, receipts, card revision, greeting state, cancellation) is **referenced, not copied**. Authority handoff per case (startup-unavailable / disconnect-listening / disconnect-speaking / disconnect-mid-tool / reconnect / repeated-failure / quota / malformed-result / device-error) rejects late events from an inactive generation (law 6). Fallback may reduce naturalness only; semantic owner, truth, action state and visible UI unchanged; legacy templates may not re-emerge as an independent semantic path.

## 16. Conversational-quality failure model (how F could still feel robotic → prevention + eval)
Fragmented context (→ memory layers + summary-fidelity eval); excessive tool calls (→ decide-to-tool threshold + latency eval); excessive/irrelevant clarification (→ relevance grader); repetitive repairs (→ repetition grader); over-blocking firewall (→ precision/recall eval; bounded schema); weak Hebrew persona (→ hosted versioned prompt + negative examples); STT errors (→ semantic routing + distortion evals); latency (→ §14 + device); narrow persona / missing meta+complaint handling (→ model-graded meta/complaint sets); deterministic logic leaking into wording (→ model owns wording; kernel never authors prose); summary degradation (→ correction-overrides-summary law + eval); repeated-failure loops (→ recovery event + eval). General conversation is natural yet **never mutates action state** (law 8 + turn contract).

## 17. Migration (staged, reversible; termination-proven; no stage ends with two semantic owners)
0 freeze corpus → 1 contracts (pure modules+tests) → 2 vertical slice (§18) → 3 live card → 4 control plane+greeting → 5 comm tools+voice enforcement → 6 rich calendar draft → 7 general model talk (gated) → 8 unified fallback → 9 delete legacy → 10 device validation. Per-stage authority table (TALK/STATE/TRUTH/UI/fallback) must show a single owner each; any stage with two turn-classifiers, two action states, two card renderers, two capability speakers, copied (not shared) state, or indefinite legacy is **rejected**. Every legacy responsibility has a finite removal criterion (stage 9). Flag-gated `?voice=realtime`; certified path intact until stage 9.

## 18. Vertical slice (falsifier)
Live Hebrew session: WhatsApp-to-known-contact → card in-session → "לא, תתקשרי אליו" interrupts → card atomically REPLACES to Call → session stays live → no 2nd greeting → no stale card → no fabricated send/dial → model truthfully says tapping opens the dialer → forced realtime drop → pipeline continues without losing the active Call action. **Necessary not sufficient** (doesn't prove Hebrew naturalness/long-session/relationship grounding/acoustics). **Rejects design if:** replacement isn't atomic; a completion claim reaches the user; fallback spawns a second brain/greeting or loses the action.

## 19. Evaluation adequacy (false-green attack → minimal portfolio)
Green-but-poor blind spots addressed: no transcript overfitting (paraphrase/morphology/pronoun generators); model-judge bias (dual-grader + adversarial counterexamples); robotic grader weakness (held baseline); long-session pressure (budgeted sessions); race omissions (interleaving reducer tests incl. barge-in+tool-result, replace-during-exec, disconnect-mid-tool); implicit hallucinations (bounded fact-schema detector); confusing UI (a11y+viewport graders); complaints/frustration/repeated-error/summary-corruption/reconnect-duplication sets. Portfolio tiers: deterministic contracts · generated semantic variants · full multi-turn conversations · state/race interleavings · model-graded quality · browser UI · simulated-Realtime events · physical-only. **Every grader ships with an adversarial counterexample proving it can fail.** Device transcript = frozen pre-implementation acceptance gate (its absence does not halt this certification; provisional corpus = failure-genome + regressions).

## 20. Physical-only boundaries
Real Hebrew mic capture; full-duplex pauses/interruption/barge-in feel; perceived naturalness/intonation/pacing; actual WhatsApp launch; actual iOS dialer launch; subjective usability. Everything else automatable.

## 21. Remaining pre-implementation gates (evidence, not architecture)
1. Device transcript (freeze corpus). 2. Realtime-capable `OPENAI_API_KEY` + quota. 3. Device validation window. 4. Final live read of the Realtime function-tool event shape before stage 5. These block *implementation acceptance*, not the architecture decision.

---

**DECISION: APPROVE — Option F (GRA-EDC) is precise, minimal, enforceable (with the honest voice-path truth asymmetry of §11), privacy-safe, migration-terminating and testable. Implementation must follow §17 starting with the §18 slice, and satisfy §21 evidence gates before acceptance.**

*Sources (2026-08-04): OpenAI Realtime conversations/function-calling — developers.openai.com/api/docs/guides/realtime-conversations, /realtime-mcp, /function-calling; platform.openai.com/docs/api-reference/realtime-calls.*
