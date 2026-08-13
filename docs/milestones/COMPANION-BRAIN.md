# ABU — THE COMPANION BRAIN

Overnight autonomous run. Branch `rc5/cognitive-architecture-and-acceptance`.
Continuity anchor: if context clears, THIS file is how a fresh session resumes.

## The thesis (the one architectural fact)
Abu **retrieves** her knowledge instead of **holding** it → she feels like a clerk, cannot
bring things up, and truthfully announces she is "about to check". Tonight: change what she IS.
Durable/personal knowledge goes **in her head** (the session instructions, as PROSE generated
from the data). Only changing/private/verifiable things stay **tools** (calendar, news, weather,
phone numbers, anything timestamped).

## The standard
Martita talks to Abu for 20 minutes and never feels she is talking to software. A stranger
hearing the recording hears two friends talking.

## Protocol (self-imposed)
- One commit per phase, pushed to RC. Never merge main, never deploy prod.
- Every phase ends green: typecheck + full suite + build + validators.
- Evidence discipline: CODE / AUTOMATED TEST / PREVIEW / DEVICE — never claim above proof.
- Loop: after each phase, judge output against the goal, improve, note the second-pass change.
- Before context runs low: update this file, say it is safe to /clear.

## Phase checklist
- [x] P0  Critique + improve this brief (see Decisions)
- [x] P1  Measure: real provider limits (instructions + transcription), prose-portrait size, headroom, cost/latency
- [x] P2  Division of knowledge: in-head vs tools-only (decided)
- [x] P3  Generate the prose portrait FROM data (generator + test: add-a-person → appears in context)
- [ ] P4  Relationships: nobody ever "unrelated"; lists (friends/family/grandchildren/Ulpan/Kfar Saba/Argentina)
- [ ] P5  Acting like a friend: never announce/stall/repeat; bring things up; connect sideways; warmth; never false-claim
- [ ] P6  Actions end-to-end: messages in Martita's voice, calls, calendar (draft survives, one-confirm-one-event)
- [ ] P7  Online that delivers: use full Tavily results; briefing fan-out ≥10 across categories; depth-on-demand; cinema; provider health
- [ ] P8  Reliability: 429 backoff-retry; plain-Hebrew recovery; name transcription bias + fuzzy/phonetic; audio; one voice engine; knowledge everywhere
- [ ] P9  Companion quality suite vs the real model; pass-rate before/after
- [ ] P10 Proposals (do not build): cross-conversation memory, initiation, confusion/repeat handling, distress, safety

## Prior in this branch (this-session device-trace fixes, already shipped)
FIX 1+2 one retrieval path (v0.215), FIX 4 active-response crash (v0.216), FIX 7 announce-before-
checking (v0.217), FIX 5 tool timeouts (v0.218), FIX 3 history retrieval path (v0.219). See
`docs/milestones/DEVICE_TRACE_FIXES_STATUS.md`. NOTE: this brief REVISES the FIX 1/3 direction —
knowledge moves INTO the head; the retrieval tools stay for CONTACT id resolution + verification.

## Decisions log
(Newest first. Every ambiguous call logged here.)

- **D0.1 — the instructions cap was measured against the WRONG failure.** The device crash that
  drove the 10,000-char instructions cap was actually `session.audio.input.transcription.prompt`
  (1024, provider-documented), NOT `instructions`. I proved via the real API that instructions at
  9,656 chars are accepted (HTTP 200). So the true `instructions` ceiling is unmeasured and likely
  far higher than 10,000. Phase 1 measures it against the real provider before deciding portrait size.
- **D0.2 — Realtime instructions are per-SESSION, not per-turn.** session.update sends instructions
  once; they are cached context on each response. So a large durable portrait is a one-time send +
  cached input, not a per-turn re-send. The brief's "cost/latency per turn" is reframed accordingly.
- **D0.3 — hybrid, not either/or.** Durable knowledge goes in the head as prose (warmth, recall,
  bringing-things-up). BUT the deterministic relationship/list engine (kinship.ts) and contact
  resolution (people_lookup want=contact, numbers server-side) STAY — the model holds the warm
  portrait AND can verify a precise relationship / resolve an id for an action. Prose is GENERATED
  from the same graph so head and tool never disagree. This preserves "never invent a relationship".
- **D0.4 — names/STT is a separate axis from head-knowledge.** "Susi heard as Sofie" is a
  transcription-bias + fuzzy-match problem (Phase 8), not fixed by putting names in instructions
  (STT reads the 1024-char transcription.prompt, not instructions).
