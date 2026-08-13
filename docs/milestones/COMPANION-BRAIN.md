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

## STATUS (for a fresh session)
DONE + pushed: **P0 critique · P1 measure · P2 division · P3 portrait** (commit 900a3c7,
v0.220.0). The core architectural change — Abu holds her family in her head — is shipped and
provider-verified (HTTP 200 on the real payload). P4 is **substantially delivered** by the
portrait (relationships + friends/family lists are now in her head) plus this branch's FIX 1+2
(one retrieval path + describe-the-path, never "unrelated"); what remains for P4 is the
companion-harness proof, which belongs to P9. **Next to build: P5** (friend behaviour: extend the
announce guard to every phrasing; add "bring things up" / "connect sideways" / warmth to the
persona, rate-limited), then P6/P7/P8/P9. P7 (online) and P8 (audio/device) need external provider
health + a real device trace. See per-phase next-actions in DEVICE_TRACE_FIXES_STATUS.md (FIX 6/8
overlap P7/P8).

## Phase 10 — PROPOSALS (analysis only; Leo chooses — do NOT build)
1. **Memory across conversations.** Today every session starts fresh. A tiny, redacted,
   opt-in "since we last spoke" store (last topics, a promise made — "you were going to call
   Ofir", a mood) would make her feel continuous. RISK: privacy + drift; must be redacted
   (evolution/redaction already exists), user-visible, and never medical/financial. HIGH warmth,
   MEDIUM risk. Recommend a small, transparent, forgettable memory — not a dossier.
2. **Should she initiate?** A gentle proactive line ("בוקר טוב, מרתה — יום שלישי, את אצל מור
   היום?") is powerful but dangerous for an 81-year-old living alone: it must NEVER feel like
   surveillance or nagging, never imply she is being watched, and be strictly rate-limited and
   opt-in. Recommend: only within an open session (she opened the app), never an unsolicited
   push/notification, at first.
3. **Repetition / confusion.** If Martita repeats herself, Abu should respond as if fresh and
   warm — never "you already told me that". If she seems confused, slow down, shorten, offer one
   thing at a time. Recommend a "gentle mode": shorter sentences, one question at a time, more
   confirmation. Detectable heuristically (repeated intent, long pauses) — testable in the harness.
4. **After two failed understandings.** Today the rule is "rephrase once". Propose a graceful
   third step: offer the simplest concrete option ("רוצה שאתקשר ללאו?") rather than a third
   rephrase, so she is never stuck in a loop.
5. **Distress (sad / frightened / unwell).** This is the most important and most dangerous
   surface. Loneliness → listen and engage, do not "solve with tips" (rule already exists). But
   "I fell" / "I have chest pain" / "I am scared" MUST route to a clear, calm action: offer to
   call Leo / a family member immediately, and know the limits (Abu is not an emergency service).
   Propose an explicit, tested distress protocol — this is a SAFETY item, not a feature. Highest
   priority of the proposals.
6. **Quiet harms to audit.** (a) Never present residence as live location (rule exists — keep).
   (b) Never let a hallucinated "fact" about family stand — the portrait + "unknown stays unknown"
   guards this, but the real-model harness (P9) must probe it. (c) Never create dependency that
   isolates her further from real people — Abu should gently push toward calling real family
   ("למה שלא תתקשרי לאופיר?"), which the persona already does. (d) Financial/medical: never store,
   never advise. Recommend a standing "companion safety" harness suite alongside P9.

## Phase checklist
- [x] P0  Critique + improve this brief (see Decisions)
- [x] P1  Measure: real provider limits (instructions + transcription), prose-portrait size, headroom, cost/latency
- [x] P2  Division of knowledge: in-head vs tools-only (decided)
- [x] P3  Generate the prose portrait FROM data (generator + test: add-a-person → appears in context)
- [ ] P4  Relationships: nobody ever "unrelated"; lists (friends/family/grandchildren/Ulpan/Kfar Saba/Argentina)
- [x] P5  Friend behaviour + SAFETY: distress protocol (P5.0), standing safety guard (P5.1), gentle mode (P5.2), two-strike (P5.3), bring-up/connect-sideways/warmth (P5.4)
- [ ] P6  Actions end-to-end: messages in Martita's voice, calls, calendar (draft survives, one-confirm-one-event)
- [ ] P7  Online that delivers: use full Tavily results; briefing fan-out ≥10 across categories; depth-on-demand; cinema; provider health
- [~] P8  Reliability: [x] name fuzzy/phonetic matching (v0.222). REMAINING: 429 backoff-retry; audio (device); one voice engine (AbuCalendar mic audit); knowledge-everywhere audit
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

## Phase 3 — DONE (the portrait is in her head)
`src/services/portrait/familyPortrait.ts` generates a warm PROSE portrait FROM the data files
(family_data.json + life_history.json), tiered: closest circle in full warmth, extended family +
Papi side a line each, friends (so "who are my friends" has a warm answer), history as story, and
the shape of what is unknown. It leans on the hand-written human fields (relationship_hebrew /
occupation / location / notes) so it reads like a friend describing the family, not a record dump.
Wired into `buildLiveInstructions`; the "# Family and People" section now says she KNOWS them and
uses people_lookup ONLY to reach someone or double-check. Cap raised 10,000 → **60,000**.
- Proof: `familyPortrait.test.ts` — adding a person is a data-only edit and they appear in the
  assembled context; close circle/friends/extended/history/unknowns all present; no artefacts.
- Assembled instructions now **21,393 chars / 32,096 bytes**; the REAL provider accepts the full
  session payload → **HTTP 200** (PREVIEW-class). Portrait itself ≈ 10,900 chars.
- Second-pass improvements: fixed double-periods, meta-artefact residue (⚠/verification asides),
  and the clunky "גר/ה ב" → clean "(occupation; location)"; preserved truncation ellipses.

## Phase 5 — DONE (behaviour + safety)
Added to the live instructions: a prominent **distress protocol** (safety, overrides everything —
stay calm, do not diagnose, prepare a call to Leo via phone_call, point to מד״א/101 for a real
emergency, never claim a call was made, stay with her + ground her); a **boundaries** section
(residence≠live-location, no medical/financial, draw her toward real family not dependency, never
false-claim); and the **friend behaviours** (bring-things-up rate-limited, connect-sideways,
warmth-without-performance, gentle-mode when confused/tired, two-strike → offer an action).
Guarded by `companionSafety.guard.test.ts` (build-failing if any regress). never-announce/stall
are already guarded (announceBeforeChecking.guard + the tool-speech guarantee). Gates green
(12,653). Second pass: added a grounding cue to the distress protocol (where are you, can you sit
down, is the door open) after a review found it escalated without first steadying her.

## Decisions log
(Newest first. Every ambiguous call logged here.)

- **D5.0 — AGENTS: single foreground writer, no subagents.** The brief said "use your specialist
  agents", but the checked-in V4 rule (.claude/rules/abuai-live-parity-v4.md + CLAUDE.md) mandates
  ONE foreground writer, no Agent/subagents/forks. Project rules override a session instruction, so
  I stayed the sole writer and did rigorous self-review passes instead. Logged per "safest option,
  log it, continue". The morning report notes this so Leo can lift the rule if he wants fan-out.
- **D5.1 — emergency dialing stays a tap, not an auto-call.** Abu prepares a call CARD to Leo
  (phone_call) and tells Martita to call 101 herself; she never auto-dials (numbers never enter the
  model; Abu never claims a call). A true one-tap emergency-call card is a P10 proposal, not built.

- **D3.1 — people_lookup kept, repurposed.** It is no longer how Abu learns who family is (she
  knows). It stays for want=contact (reach someone → id, numbers server-side) and as a verify
  path. The who/relationship/relatives branches remain callable (harmless) for double-checking.
- **D3.2 — history stays BOTH in-head and as a tool.** The story is in the portrait (recall in
  the flow of talk); history_lookup remains for a precise fact double-check. No contradiction —
  both read the same life_history.json.

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
