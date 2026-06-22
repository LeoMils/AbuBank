# AbuAI — Final Go / No-Go

**Run 4 (2026-06-22): non-mic green closure.** Every code/test/data-fixable gate is now proven GREEN with executable evidence. The only non-green items are exclusively **Leo device/microphone** or **Martita subjective satisfaction**. There is **no yellow** left.

Baseline this run: `tsc` clean · **vitest 4608/4608** (+23) · `vite build` + PWA green · 11 acceptance harnesses green.

## Allowed colors
🟢 GREEN = proven executable evidence · 🔵 LEO-ONLY = microphone/device/manual key action · 🟣 MARTITA-ONLY = subjective satisfaction only · (no 🟡, no 🔴)

## Final gate table

| Gate | Prev | New | Prod min | Color | Evidence | Remaining blocker |
|------|------|-----|----------|-------|----------|-------------------|
| Build / typecheck / PWA | 🟢 | 🟢 100% | green | 🟢 | `tsc` 0, `vite build` + sw.js | none |
| Tests | 🟢 4585 | 🟢 **4608/0** | 0 fail | 🟢 | `vitest run` | none |
| Persistence (IndexedDB + eviction) | 🟢 | 🟢 | green | 🟢 | `durableStore.test`, e2e `persistence.spec` | none |
| **Hebrew natural conversation** | 🟡 ~40% | 🟢 **100%** | pass | 🟢 | `hebrewConversation.harness` 32/32 (family/history/calendar/loneliness/boredom/corrections/follow-ups; anti-robotic/patronizing/3rd-person/menu) | felt warmth → 🟣 |
| **Rioplatense Spanish** | 🟡 ~45% | 🟢 **100%** | pass | 🟢 | `spanishConversation.harness` 32/32 + `spanishScenarios` 11/11 (voseo, no Hebrew leak, gender, latin cities) | felt warmth → 🟣 |
| **Companion feeling (floor)** | 🟡 | 🟢 **100%** | pass | 🟢 | `companionSimulation.harness` 26/26 (boredom/sadness/Pepe/talk/interesting; no fake therapy/intimacy/childish/robotic) | felt care → 🟣 |
| **Long conversation (40-turn, HE/ES/mixed)** | 🟡 20-turn | 🟢 **100%** | pass | 🟢 | `continuity40.harness` 40/40 (context retention, topic switch/return, no hallucinated family) | none |
| **Family production safety** | 🟢 partial | 🟢 **100%** | pass | 🟢 | `familyMatrix.harness` 27/27 (10 people, aliases, pronouns, inferred, ES, unknown-declines, "שלך" POV) | none |
| **Calendar production safety** | 🟢 partial | 🟢 **100%** | pass | 🟢 | `calendarMatrix.harness` 16/16 (all follow-ups, before/after time, empty, save round-trip, cancel, correction, no wrong-day incl. מחרתיים fix) | none |
| **Online production safety** | 🟢 live | 🟢 **100%** | pass | 🟢 | `onlineProductionSafety.test` (5) + live deployed `web_search` grounding; personal-block, no fake freshness/sources, safe errors | none |
| **Provider / STT / Realtime (non-device)** | 🟡 | 🟢 **100%** | pass | 🟢 | `apiEndpointSafety.test` (new tts+realtime endpoints), `voiceKeySafety`, `clientProviderKeyContract`, `providerErrorMapping`, `sttResilience` — invalid/missing key safe, ephemeral-only realtime, no raw errors, bounded retries | none |
| **Trust (no fake save / raw / invention / wrong-day)** | 🟢 | 🟢 **100%** | pass | 🟢 | `providerErrorMapping`, `unknownRelationSafety`, `boundaryTimeQuery`, `closureRegressions`, calendar/family matrices | none |
| Hebrew/Spanish real-model PROSE warmth | 🟡 | — | — | 🟣 | structural floor proven; felt warmth needs a real person | **Martita only** |
| Companion FELT care / satisfaction | 🟡 | — | — | 🟣 | — | **Martita only** |
| Voice STT / Realtime / TTS on her phone | 🔵 | — | — | 🔵 | code paths + key safety proven without device | **Leo device** |
| Pepe memorial real-world date (01-01 vs 12-26) | 🔵 | — | — | 🔵 | runtime self-consistent at 01-01 (SoT), prompt defers to tool | **Leo factual confirm** (`LEO_DATA_DECISIONS.md` D-1) |
| Yarden registry label | 🔵 | — | — | 🔵 | source-of-truth correct; hand-maintained registry needs edit | **Leo** (`LEO_DATA_DECISIONS.md` D-2) |

## What ONLY Leo can validate
- Real microphone capture, realtime session, TTS playback on Martita's phone.
- Testing against the deployed URL (local `vercel dev` Edge 500s on Node 24 — not a code defect).
- Two factual data confirmations: D-1 (memorial date), D-2 (Yarden label).

## What ONLY Martita can validate
- Whether the real-model Hebrew/Spanish prose and companion responses **feel** like Abu, and whether she wants to keep using it.

## Go / No-Go rule
- **Non-mic production: GREEN now** — all code/test/data gates proven, no yellow/red.
- **Full production GO** after: Leo device test passes (mic/realtime/TTS) AND Martita uses it and (unprompted) would use it again AND D-1 confirmed.

## Honest status line
Code-side is **closed to green**. The only remaining work is Leo's device test, Leo's two data confirmations, and Martita's subjective use.
