# AbuAI — Production Acceptance Board

**The single durable acceptance truth.** A capability is only as green as its WEAKEST honest
evidence class for the experience Martita actually has. Passing unit tests are `CODE` evidence —
they do NOT turn a row green. Real device/production evidence overrides any number of mocks.

**Stamp:** build `0.67.0-natural-slotfill-clarify` · branch `rc5/cognitive-architecture-and-acceptance`
· updated 2026-07-13 (recovery cycles: 0.64.0 durable-flush-on-hide, 0.65.0 current-info-grounding,
0.66.0 fragmented-create-continuity, 0.67.0 natural-slotfill-clarify). Earlier baseline: `0.63.0` /
commit `090b54b` (pre-FR1, 2026-07-12).
Schema: `src/engineering-os/evidence.ts`. Classes: `CODE < MOCK < BROWSER < PREVIEW < PHYSICAL_DEVICE < PRODUCTION`.

> ⚠️ This board is intentionally NOT optimistic. Most rows are RED/YELLOW because physical
> acceptance failed. Nothing here was made green by this Foundation task (no product code changed).

## Legend
`✓` proven at this class · `~` partial/observed-once · `✗` failed at this class · `–` not attempted/NA.
Status: 🟢 accepted · 🟡 partial (works at a weaker class, unproven at the class acceptance needs) · 🔴 failing/not accepted.

## Board

| Capability | CODE | MOCK | BROWSER | PREVIEW | DEVICE | PROD | Status |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Voice (loop) | ✓ | ✓ | ~ | – | ✗ | – | 🔴 |
| STT | ✓ | ✓ | ~ | – | ✗ | – | 🔴 |
| TTS | ✓ | ✓ | ✓ | – | ✗ | – | 🟡 |
| Online (current info) | ✓ | ✓ | ~ | ~ | ✗ | – | 🔴 |
| Calendar (write/read/modify) | ✓ | ✓ | ~ | – | ✗ | – | 🔴 |
| Working Memory | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Persistent Memory | ✓ | ✓ | – | – | ~ | – | 🟡 |
| Family Graph | ✓ | ✓ | – | – | ~ | – | 🟡 |
| Follow-up | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Correction Handling | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Grounding (residence≠live loc.) | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Natural Conversation | ✓ | ✓ | – | – | ✗ | – | 🔴 |
| Latency (~20s observed) | ~ | ✓ | ~ | – | ✗ | – | 🔴 |
| Mobile / PWA | ✓ | ✓ | ✓ | ~ | ~ | – | 🟡 |
| Privacy (keys/PII) | ✓ | ✓ | – | – | – | – | 🟢 (CODE) |
| Diagnostics | ✓ | ✓ | ~ | – | ~ | – | 🟡 |

## Detail (last evidence · first divergence · blocker · next acceptance action)

- **Voice 🔴** — Software playback + fallback proven at BROWSER; `REALTIME_AUDIO_TIMEOUT` watchdog
  added (0.63.0). *First divergence:* physical iPhone mic capture / audible warmth / on-device
  latency unproven. *Blocker:* P0-DEVICE + P0-REALTIME (device-only). *Next:* run
  `docs/abuai/LEO_COMPANION_BREAKTHROUGH_RETEST.md` on a physical iPhone; record `PHYSICAL_DEVICE` evidence.
- **STT 🔴** — Hebrew-biased language pin across all 3 engines (CODE). *Blocker:* no device transcript
  accepted. *Next:* device capture → verify Hebrew/Spanish transcription accuracy.
- **TTS 🟡** — Browser playback green; audible warmth on device unproven. *Next:* device audibility test.
- **Online 🔴** — Failed physical acceptance: current World Cup question returned a stale/false
  historical answer. *First divergence:* time-sensitive query answered from model memory instead of a
  retrieval tool. **CODE progress (0.65.0):** the routing half of that first divergence is now closed —
  volatile world-fact questions (current office holders, election results, winners) that the narrow
  category regexes missed used to fall to the offline `general`/LLM path; a semantic `requiresCurrentInfo()`
  detector now routes the whole class to the online provider (or an honest refusal on failure). Regression:
  `src/screens/AbuAI/currentInfoGrounding.test.ts` (17 cases, incl. negative guards vs calendar/evergreen).
  *Still RED because:* the real provider is mocked in every test — no PREVIEW/DEVICE proof that a live
  "who won / latest" query actually returns a grounded, sourced answer on device. *Blocker:* grounding on
  real retrieval on device. *Next:* PREVIEW/device test of "who won / latest" with sources shown
  (see `.claude/rules/online.md`).
- **Calendar 🔴** — Write→read→modify continuity failed on device. *First divergence:* a just-created
  event not reliably readable/modifiable in the same session. *Next:* device transactional test; a
  gold replay of the failing session (`gold-replay`).
- **Working Memory / Follow-up / Correction 🔴** — Follow-up understanding and explicit transcript
  correction failed on device. *Next:* `failure-to-regression` red tests from the real transcripts, then fix.
- **Grounding 🔴** — Residence (Kfar Saba) was presented as live location. *First divergence:* a static
  fact rendered as real-time location. *Next:* device test; assert residence≠live-location copy.
- **Natural Conversation 🔴** — Felt robotic and fragmented on device. **CODE progress (0.66.0):** the
  #1 code-side red-team failure — a fragmented ("drip") calendar create where "תקבעי" → "עם מור" →
  "מחר בשלוש" → "כן" lost the thread and orphaned each fragment to the LLM — is fixed at its first
  divergence: a bare create opener now opens a pending draft that absorbs the following fragments.
  Red-team `fragmented-create-lost` drops **60→24** conversations (1560-conversation run); gold replay
  `src/eval/fragmentedCreateGoldReplay.test.ts`. *Remaining (separate divergence):* an ambiguous bare hour
  ("בשמונה", 7–11) in the fragment path stays AM/PM-ambiguous so a bare "כן" does not complete — the
  single-utterance path resolves it via the smart layer; the fragment path needs the same parity.
  **CODE progress (0.67.0):** the mid-create robotic reprompt is fixed — after the person fragment,
  `shapeCreateClarify` used to emit the bald "באיזה יום?" which the dialogue loop-breaker escalated into a
  dead-end "say it again"; it now asks a warm, person-aware "לאיזה יום ושעה לקבוע עם <who>?" so every
  fragmented create flows naturally (title→day/time→confirm→save). Gold replay asserts T2 naturalness.
  *Still RED because:* device felt-quality is unproven at CODE — *Next:* natural-conversation judge
  (`conversationQualityJudge`) on real transcripts + device re-test.
- **Latency 🔴** — ~20s observed on device. *Next:* per-stage latency budget (`latency-budget`), device timing.
- **Persistent Memory / Family Graph 🟡** — Generated from `knowledge/*`; `validate:family` + gender
  regression green at CODE. Device conversation continuity unproven. *Next:* device continuity test.
- **Mobile/PWA 🟡** — Installs + stale-bundle detection (`versionSync`) proven at CODE/BROWSER; device
  audio permission path is the open risk. *Next:* device install + mic-permission walkthrough.
- **Privacy 🟢 (CODE)** — Billable keys server-only, enforced by `clientProviderKeyContract.test.ts`;
  `.env` gitignored + never in history; build-env guard added (`scripts/check-client-secret-leak.cjs`).
  This is CODE-class; it is the right class for this capability (no device claim needed).
- **Diagnostics 🟡** — Rich in-app diagnostics (Product Truth panel, voice flight recorder) at CODE;
  no external SLO/telemetry sink. *Next:* wire a minimal external latency/SLO report.

## How to update this board
Use the `production-reality` skill. Every change to a row must cite the evidence and its class, and
the row's color must be defensible by the WEAKEST honest class. Never upgrade a class you did not observe.
