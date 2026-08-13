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

## Phase 1 — MEASUREMENTS (real numbers)
Provider limits (measured against the real `/v1/realtime/client_secrets`, which matched device
behaviour for the transcription field, so it is the same validator the session.update hits):
- **`session.instructions` max ≥ 200,000 chars** — 200k returned HTTP 200; the ceiling is above
  that, unmeasured. (The old 10,000 cap was a MISDIAGNOSIS — the device crash was the transcription
  prompt, not instructions.)
- **`session.audio.input.transcription.prompt` max = 1024 chars** — cited from the provider error.

Current payload: instructions 9,984 chars / 12,617 bytes · transcription.prompt 995 (cap 1024) ·
tools[] 8,895 chars. People store = **65** non-pet people (the brief's "68" is approximate).

Prose portrait size (measured a real 3-person warm sample = 164 chars/person avg, then tiered):
- close circle 15 × ~230 = 3,450 · middle 25 × ~120 = 3,000 · distant 25 × ~70 = 1,750
- history ≈ 1,800 · tastes/rituals ≈ 900 · friendships/origins ≈ 700
- **PORTRAIT ≈ 11,600 chars.** instructions after portrait ≈ 10k + 12k = **~22k chars — 11× under
  the 200k limit.** Fits in her head with enormous headroom.

Cost/latency: instructions are sent ONCE per session (session.update) and cached on each response
(prompt caching ~10× cheaper); ~22k chars Hebrew ≈ ~12–15k tokens one-time + cached. The per-TURN
cost is the conversation, not the re-sent portrait. **Acceptable for voice.**

**DECISION (P1): put the portrait in her head.** Raise the instructions guard from 10,000 to a
generous-but-safe cap (60,000 — far under the 200k limit, still catches runaway) and inject the
generated portrait.

## Phase 2 — DIVISION OF KNOWLEDGE (decided)
IN HER HEAD (durable/personal, as generated prose): who the family + friends are and how each
relates to Martita and each other; homes, work, marriages, losses; the life history (Argentina →
Mendoza → Casa Milstein → aliyah → Ulpan → Bat Yam); Martita's tastes/dislikes/rituals/rhythm
(Tuesday at Mor's, never red wine); how names are pronounced (rule + the closest names spelled);
and **the shape of what is unknown** (the open_questions, so she owns her ignorance).
TOOLS ONLY (changing/private/verifiable): calendar (read/create/correct/confirm/cancel); news /
weather / current info; phone numbers + WhatsApp (numbers NEVER enter the model — server-side id
resolution); anything timestamped.
KEPT AS TOOLS FOR VERIFICATION/ACTION (D0.3 hybrid): `people_lookup want=contact` (id+label for
an action) and the deterministic `kinship`/relationship + list engine — the model holds the warm
portrait AND can verify a precise relationship or resolve an id. The portrait is GENERATED from
the same graph, so head and tool never disagree. This preserves "never invent a relationship".

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
