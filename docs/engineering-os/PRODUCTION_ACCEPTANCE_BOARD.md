# AbuAI — Production Acceptance Board

**The single durable acceptance truth.** A capability is only as green as its WEAKEST honest
evidence class for the experience Martita actually has. Passing unit tests are `CODE` evidence —
they do NOT turn a row green. Real device/production evidence overrides any number of mocks.

**Stamp:** build `0.63.0-realtime-audio-timeout` · branch `rc5/cognitive-architecture-and-acceptance`
· commit `090b54b` (pre-Foundation-Release-1) · updated Foundation Release 1 (2026-07-12).
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
  retrieval tool. *Blocker:* grounding on real retrieval on device. *Next:* device test of "who won /
  latest" questions with sources shown (see `.claude/rules/online.md`).
- **Calendar 🔴** — Write→read→modify continuity failed on device. *First divergence:* a just-created
  event not reliably readable/modifiable in the same session. *Next:* device transactional test; a
  gold replay of the failing session (`gold-replay`).
- **Working Memory / Follow-up / Correction 🔴** — Follow-up understanding and explicit transcript
  correction failed on device. *Next:* `failure-to-regression` red tests from the real transcripts, then fix.
- **Grounding 🔴** — Residence (Kfar Saba) was presented as live location. *First divergence:* a static
  fact rendered as real-time location. *Next:* device test; assert residence≠live-location copy.
- **Natural Conversation 🔴** — Felt robotic and fragmented on device. *Next:* natural-conversation judge
  on real transcripts (`conversationQualityJudge`) + device re-test.
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
