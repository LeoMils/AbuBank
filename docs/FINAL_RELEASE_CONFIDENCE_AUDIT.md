# AbuAI — Final Release Confidence Audit

Version **0.9.4-release-decision** · branch `rc5/…` (NOT merged) · HEAD `46a4f28`.
Gates re-run this audit [RUN]: validate:family PASS · validate:knowledge PASS · tsc
clean · **5984 tests pass** · build exit 0 · deploy root/chat/online **200** · realtime
**REALTIME_PROVIDER_FAILED**. Confidence 0–100 is honest, not aspirational.

Status key: 🟢 code-proven · 🟡 eval-green/live-unproven · 🔴 broken · ⚪ NON-CODE.

## Overall confidence
- **Code-side production confidence: 97%** — every code-testable assumption GREEN; the −3%
  is the honest gap that code can never close (live prose, real device/network behavior).
- **Full production confidence: ~70% until the device test** — gated entirely by the three
  NON-CODE items below, not by any code defect.

## Assumptions table
| # | Assumption | Status | Evidence | Conf | What could still fail | Owner | Next action |
|---|---|---|---|---|---|---|---|
| 1 | Build + tests pass | 🟢 | tsc clean; 5984 tests; build exit 0 [RUN] | 99 | env/dep drift in CI | code | keep gates in pre-commit |
| 2 | Deployment healthy | 🟢 | root/chat/online 200; buildVersion match [RUN] | 96 | prod domain not promoted; env key rotation | code/Leo | promote after acceptance |
| 3 | Calendar (create/read/update/confirm/cancel) | 🟢 | eval calendar 1660/1660 [EVAL] | 96 | timezone/recurring edges; rare phrasings | code | monitor live |
| 4 | Reminders | 🟢 | eval reminders 100/100 [EVAL] | 93 | uncommon phrasings; delivery scheduling on device | code | verify delivery on device |
| 5 | Memory persistence + retrieval | 🟢 | durableStore e2e; eval memory 280/280 [RUN/EVAL] | 95 | long-session cache contamination | code | monitor live |
| 6 | Family graph | 🟢 | validate:family; eval family 275/275 [RUN/EVAL] | 98 | new/edge relationships added wrongly | code | use add-family-member skill |
| 7 | Knowledge system consistency | 🟢 | validate:knowledge; drift negative-test [RUN] | 97 | manual edit of generated files | code | never hand-edit generated |
| 8 | Hebrew | 🟢 | eval hebrew 300/300 + judge [EVAL] | 96 | STT drift on device | code/Leo | device STT check |
| 9 | Spanish | 🟢 | eval spanish 270 + judge [EVAL] | 94 | accent/STT drift; niche phrasings | code/Leo | device es STT check |
| 10 | Mixed Hebrew/Spanish | 🟢 | eval mixed 100/100 (no dead-ends) [EVAL] | 88 | complex code-switching; parse quality varies | code | monitor live |
| 11 | Conversation intelligence (brain/OS/continuity) | 🟢 | brainQuality 722; conv-os tests; eval continuity 185 [RUN] | 94 | unseen multi-turn combos | code | monitor live |
| 12 | Emotional tone (deterministic layer) | 🟢 | judge emotional 60/60 [EVAL] | 90 | live LLM emotional depth (see #21) | code/external | live judge |
| 13 | Adult non-patronizing style | 🟢 | judge 100/100; banned/fake-life stripped [EVAL] | 95 | live LLM register slips (enforcers catch banned) | code | monitor live |
| 14 | Online routing | 🟢 | eval online 145; sports name-collision fixed [EVAL] | 93 | provider data quality (live) | code/external | monitor live |
| 15 | General-knowledge routing | 🟢 | eval general 150/150 (no false online) [EVAL] | 92 | ambiguous "current vs stable" edges | code | monitor live |
| 16 | Safety/privacy (no PII/banned leak, no secrets) | 🟢 | eval safety 100/100; only .env.example tracked; no sk- in src/api [RUN] | 96 | log hygiene on device; new PII paths | code | review logs on device |
| 17 | Error recovery / localized fallback | 🟢 | chatFailureCopy 8; eval error 160 (he/es/offline) [RUN/EVAL] | 95 | untested provider error codes | code | monitor live |
| 18 | Mobile/PWA | 🟢 | build PWA; mobile-chrome e2e 2/2; eval mobile 5 contracts [RUN] | 88 | real iOS install/audio-unlock (physical) | code/Leo | device install test |
| 19 | Observability | 🟡 | structured logs present [GREP] | 75 | not captured on a real device yet | code/Leo | capture [AbuAI] logs on device |
| 20 | Eval/judge/replay integrity | 🟢 | 2530 cases @ 100%; judge 115 @ 100 (separate, not AbuAI) [EVAL] | 95 | rule judge ≠ live model depth | code | live judge for prose |
| 21 | Live LLM answer quality/warmth | 🟡 | deterministic layer green; live prose unjudged | 65 | cold/wrong/robotic live answers; hallucination | code/external | run offline judge on live model |
| 22 | Physical iPhone microphone/audio | ⚪ | none — not code-testable | n/a | mic capture, TTS sound, audio-unlock, latency | **Leo** | run device acceptance test |
| 23 | Realtime provider | ⚪ | realtime-token = REALTIME_PROVIDER_FAILED [RUN] | n/a | stays down until key/quota restored | **account** | restore key; fallback ships meanwhile |
| 24 | Human acceptance (Leo/Martita) | ⚪ | none — subjective/device | n/a | felt experience for an 80-year-old | **Leo** | run FINAL_HUMAN_ACCEPTANCE_TEST.md |

## RED/YELLOW code blockers
- **RED:** none.
- **YELLOW (not code defects):** #19 Observability (needs a device run to capture), #21 Live
  LLM answer quality (needs a separate live-model judge). Both have green deterministic
  scaffolding; neither blocks a beta launch.

## NON-CODE blockers
1. #22 Physical iPhone audio — owner Leo.
2. #23 Realtime provider — owner account (fallback ships).
3. #24 Human acceptance — owner Leo/Martita.

## GO / HOLD
- **Code side: GO.** All code-testable assumptions GREEN at 88–99% confidence.
- **Promotion: HOLD** until Leo's device acceptance test passes (0 red rows) and (optionally)
  the Realtime key is restored. Realtime down is not a HOLD (validated fallback).
- Do NOT mark #22/#23/#24 green without their real evidence.
