# Final Production Go / No-Go

Build: `0.5.9-final-production-gates`. Branch: `rc5/cognitive-architecture-and-acceptance`.
Honesty rule: a gate is GREEN only with reproducible proof. Gates that require a
physical iPhone + a live human are marked **DEVICE/HUMAN** — an automated agent
cannot close them, and they are NOT marked green.

## Validation commands (run this session)
| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npx vitest run` | ✅ 184 files, 4972 passed, 0 failed |
| `npx vite build` | ✅ exit 0 |
| `npx playwright test e2e/abu-games-visual.spec.ts` (current build) | ✅ pass + screenshots |
| `npx playwright test e2e/persistence.spec.ts` (current build) | ✅ pass (IDB durability) |
| `npx playwright test e2e/production-smoke.spec.ts` (live `/api`) | ✅ 5 scenarios pass on the API server |

Note: the long-running dev server on `:5175` went stale during the multi-session
work; the persistence spec FAILS against it and PASSES against a fresh build
(`vite preview`/`vercel dev`). Always run e2e against a fresh server.

## Gate status
| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Calendar create (100 hostile, product write path) | 🟢 | 100/100 exact, 0 P0 — `finalNonMicProductionAcceptance.test.ts` |
| 2 | Calendar read (all routes, one source of truth) | 🟢 | section B of the same harness |
| 3 | Semantic understanding + deterministic safety | 🟢 | `semanticUnderstanding.test.ts`, harness C |
| 4 | STT mistake recovery | 🟢 | `sttSemanticRecovery.test.ts` (43 cases) |
| 5 | Subject/purpose/location/notes | 🟢 | corpus rows; 0 invented |
| 6 | Family graph + continuity | 🟢 | harness D; `nonVoiceProductionClosure.test.ts` |
| 7 | Local conversation memory (40-turn) | 🟢 | harness E; `conversationMemory.ts` |
| 8 | Companion personality (100 cases) | 🟢 | harness F; 0 banned survive |
| 9 | Online routing honesty | 🟢 | harness G |
| 10 | Representative corpus (intent) | 🟢 | 103/104 = 99%, 0 P0 — `finalProductionGates.test.ts` |
| 11 | Reliability (100 creates/reads, persistence, offline, corruption) | 🟢 | `finalProductionGates.test.ts` PHASE 4 + persistence e2e |
| 12 | IndexedDB durability (survives eviction) | 🟢 | persistence e2e on current build; init() now awaits migration writes |
| 13 | Abu Games UX (412×870, bubbles, a11y) | 🟢 | `abu-games-visual.spec.ts` + screenshots |
| 14 | Screen audit (RTL / version / error / loading) | 🟢 | RTL in all 5 screens; `APP_VERSION` surfaced; `ErrorBoundary`+`Suspense` in App |
| 15 | Voice diagnostics emit | 🟢 | TTS_ENGINE_USED / VOICE_NAME / TTS_SUCCESS / STT_SUCCESS / REALTIME_STATUS / AUDIO_UNLOCK_STATUS |
| 16 | **Real-device voice** (mic, STT, TTS speaks, realtime, barge-in) | 🔴 **DEVICE** | cannot be proven without a physical iPhone — diagnostics + code paths in place; needs Leo |
| 17 | **Live Martita pilot** (20–30 min, no coaching) | 🔴 **HUMAN** | script ready (`MARTITA_PILOT_SCRIPT.md`); needs Martita |

## Remaining risks
- Real-device audio (iOS unlock / provider quota) is unverified in CI — the
  `TTS_EVIDENCE` + `STT_SUCCESS` + `REALTIME_STATUS` + `AUDIO_UNLOCK_STATUS` logs
  exist so Leo can diagnose on the phone, but actual playback is device-only.
- The live LLM semantic round-trip is CI-tested only via a mocked provider; the
  deterministic engine is the proven offline floor + the grounding authority.
- Subjective quality (voice warmth, Games "premium" feel) needs human eyes.

## Final verdict
Non-device/non-human gates (1–15) are GREEN with reproducible proof. Gates 16
and 17 are real, mandatory production gates that an automated agent cannot close;
they require Leo + iPhone + Martita. Therefore:

**FINAL_PRODUCTION_BLOCKED** on exactly two gates: (16) real-device voice proof,
(17) live Martita pilot. All code/logic/UX/memory/reliability work is complete and
proven. Run the pilot script + device voice checklist to close the last two.
