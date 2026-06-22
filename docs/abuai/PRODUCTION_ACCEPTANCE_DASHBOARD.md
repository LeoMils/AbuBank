# AbuAI — Production Acceptance Dashboard
**The single source of truth for AbuAI production readiness.**

- App version: `abu-bank@30.10.0`
- Branch: `rc5/cognitive-architecture-and-acceptance`
- Date compiled: 2026-06-22
- Compiled by: automated evidence collection across all acceptance harnesses, the test suite, all `docs/abuai/*` reports, the live gate, the Playwright e2e run, and a live deployed-Edge probe.

> **Goal restated:** AbuAI must be a *real companion* for Martita — not a chatbot, not a green dashboard. This document does not fake green. Where a thing is proven by an executed assertion it says so; where it is only specified/architected or needs a real person, it says that too.

---

## RUN 3 — DEEP-REVIEW RELEASE-BLOCKER CLOSURE (2026-06-22)

Closed the release blockers surfaced by `DEEP_REVIEW_DOSSIER.md`. **Test suite: 4570 → 4585 (+15), 0 fail.** tsc clean, build+PWA green, all 5 harnesses pass.

| Blocker | Status | Evidence | Residual |
|---------|--------|----------|----------|
| **B1 — Pepe memorial date in live prompt** | **FIXED (runtime)** | SYSTEM_PROMPT now defers to `get_memorial_for` (no hardcoded Dec-26); rules aligned; `memorialDatePromptContract.test.ts` (4) | soft Leo confirmation of real-world date (runtime self-consistent at 01-01 SoT) |
| **B2 — client-exposed billable OpenAI key** | **FIXED** | 5 client sites → server proxies (`api/abuai-tts`, `api/realtime-token`, `api/abuai-chat`); `clientProviderKeyContract.test.ts` guard; `ENV_CONTRACT.md` | Groq/Gemini stay client free-tier (documented); full server-proxy = post-pilot hardening |
| **B3 — spend-guard persistence** | **REFRAMED (no code)** | guard is contract-only by design (`jointOptimizationContract.test.ts:287`) → no live caps to reset | enforce caps = deferred Leo product decision (supervised pilot = observable) |
| **B4 — version identity** | **FIXED + reframed** | split is by-design; fixed stale buildDate/branchHint; health↔version sync now test-locked | none |
| **B5 — Open-Meteo weather TODO** | **REFRAMED (no code)** | router unwired; weather works via proven `web_search` | Open-Meteo = non-blocking cost optimization |

**Verdict after Run 3:** `READY_EXCEPT_LEO_AND_MARTITA_ONLY` — code-side release blockers closed; remaining items are Leo's memorial-date confirmation (D-1, soft) + Leo device/voice + Martita real-use. Spanish/companion/voice still **not green**.

---

## RUN 2 — PRODUCTION CLOSURE UPDATE (2026-06-22)

Closed every non-device, non-human blocker that code/test/data could close. **Spanish, companion warmth, and voice are deliberately NOT marked green** — they need a real run / device / user.

- **Previous blended score: ~72%** → **New blended score: ~78%** (engineering/deterministic floor ~95%→~97%; real-user/live ceiling unchanged at ~40% — that only moves in the pilot).
- **Test suite: 4547 → 4570 (+23), 0 failures.** Files 160 → 165. tsc clean, build+PWA green (re-run this run).

| Item | Before | After | Color | Evidence | Remaining blocker | Owner | Next action |
|------|--------|-------|-------|----------|-------------------|-------|-------------|
| Summary memory bug (`generateLLMSummary`) | broken silent fallback | **fixed** | 🟢 | `summaryProxyContract.test.ts` (3) — correct `{body,lang,stream}` + wrapped read | none | eng | — |
| Provider error → safe message | implicit | **proven** | 🟢 | `providerErrorMapping.test.ts` (6) — no raw JSON/he/es/en | none | eng | — |
| Unknown-relation safety | gap | **proven** | 🟢 | `unknownRelationSafety.test.ts` (5) — unknown→null, honest "no tiene" | none | eng | — |
| Before/after bare-word time (read) | doc'd as failing | **proven working** | 🟢 | `boundaryTimeQuery.test.ts` (5) — `אחרי ארבע`→16:00 | create-phrasing only (low) | eng | — |
| Spanish (deterministic shaping) | 45% specified | **proven well-formed** | 🟡 | `spanishScenarios.harness.ts` 11/11 — Rioplatense, no Hebrew leak | **live conversational Spanish unproven** | Leo/Martita | pilot Block D |
| Live 20-turn continuity | stub only | **deterministic proven** | 🟡 | `continuity20.harness.ts` 12/12 (pronoun/topic-switch/תמשיכי/grief) | felt warmth unproven | Leo/Martita | pilot |
| Voice key safety (no device) | logic only | **proven** | 🟡/⚪ | `voiceKeySafety.test.ts` (5) — placeholder→quiet fallback, bounded retries | real mic/realtime/TTS | Leo | pilot Block H |
| Memorial date (D-1) | contradiction | **documented for Leo** | 🔴 | `LEO_DATA_DECISIONS.md` D-1 (01-01 vs 12-26) | Leo's factual decision | Leo | decide before pilot Block E |
| Yarden label (D-2) | contradiction | **documented for Leo** | 🔴 | `LEO_DATA_DECISIONS.md` D-2 (Eili's wife, not Ofir's) | human-approval edit | Leo | reconcile registry |

**Still NOT green (unchanged — by design):** real-model Hebrew warmth, **Rioplatense Spanish in real use**, emotional/companion feeling, voice on Martita's device, Martita satisfaction. These move only in the pilot — see `FINAL_GO_NO_GO.md`.

---

## 0. How to read this (scoring legend — no fake green)

Two different things are being measured and they are **kept separate on purpose**:

- **Deterministic / engineering readiness** — proven by executed code (vitest assertions, harnesses, e2e, build).
- **Real-user / live-model readiness** — whether the *actual experience* (LLM warmth, Spanish, voice on a real device, Martita's satisfaction) has been observed. Most of this is **NOT yet proven** and is the real remaining risk.

`Current %` reflects **production-validated reality**, blending both. A category can have a flawless deterministic floor and still score low if the thing Martita feels is unproven.

| Color | Meaning |
|-------|---------|
| 🟢 GREEN | Proven by executed evidence at production bar |
| 🟡 AMBER | Deterministic floor proven; real-model/real-user quality unproven OR minor gap |
| 🔴 RED | Not validated for production; real risk to Martita |
| ⚪ LEO | Can only be validated by Leo on a real device (mic/audio) |

**Evidence tiers:** HIGH = executed assertion / live API 200 with real payload. MEDIUM = deterministic harness with stub LLM. LOW = specified/architected only, never executed with real model/user.

---

## 1. ENGINEERING — 🟢 (re-verified this session)

| Gate | Current | Required | Color | Evidence (HIGH) | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|-----------------|----------------|------------|-------|-------------|-------|
| build | 100% | 100% | 🟢 | `npm run build` exit 0; vite built in 7.37s | none | — | CI | none | YES |
| typecheck | 100% | 100% | 🟢 | `tsc --noEmit` exit 0 | none | — | CI | none | YES |
| tests | 100% | 100% | 🟢 | **160 files / 4547 tests passed / 0 failed** (vitest, this session). 0 `.skip`/`.todo` | none | — | CI | none | YES |
| build / PWA | 100% | 100% | 🟢 | PWA generateSW: 25 precache entries (880 KiB), `dist/sw.js` + workbox emitted | none | — | CI | none | YES |
| deploy readiness | 95% | 90% | 🟢 | Vercel deploys "● Ready" (prod+preview); deployed `/api/health` → 200, `OPENAI_API_KEY: present`, chat+online `configured` | local `vercel dev` 500s on outbound-fetch Edge fns | local Node-24 Edge-runtime emulation only — **not code** (same code returns 200 on deployed Edge) | Leo/infra | test against deploy URL, not local `vercel dev` | YES |

**Engineering verdict: shippable.** This is the strongest part of the product and it is genuinely green.

---

## 2. PERSISTENCE — 🟢 / 🟡

| Gate | Current | Required | Color | Evidence | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|----------|----------------|------------|-------|-------------|-------|
| IndexedDB | 95% | 90% | 🟢 | `src/services/durableStore.ts` (real, wired into App/main/AbuAI/AbuCalendar); `durableStore.test.ts` in passing suite | none | — | eng | — | YES |
| localStorage mirror | 95% | 90% | 🟢 | `durableStore` write-through mirror; `persistenceKeys.test.ts` | none | — | eng | — | YES |
| reload recovery | 95% | 90% | 🟢 | **e2e `persistence.spec.ts`: seed→reload→migrate→IndexedDB; Playwright last-run `status: passed`, 0 failed** | none | — | eng | — | YES |
| eviction recovery | 90% | 85% | 🟢 | same e2e: clear localStorage → reload → restored from IndexedDB (HIGH, but single e2e case) | only one eviction scenario | thin breadth | eng | add 1–2 eviction breadth cases | YES |
| conversation history | 80% | 85% | 🟡 | covered implicitly (`service.test.ts`, `conversationProductionProof.test.ts`); no dedicated reload-survives-history assertion | no isolated test | coverage gap | eng | add explicit history-reload test | YES (low risk) |
| summary | 80% | 80% | 🟡 | `generateLLMSummary` falls back to deterministic pattern summary (`service.test.ts`) | LLM summary call uses wrong proxy contract (see P2-1) → always pattern fallback | `service.ts:146` posts `{model,messages}` not `{body,lang,stream}` | eng | fix contract OR confirm fallback intended | YES (degraded) |
| calendar | 95% | 90% | 🟢 | `calendarPersistence.test.ts`, `calendarProductionProof.test.ts` | none | — | eng | — | YES |
| reminders | 95% | 90% | 🟢 | `reminderStore.test.ts`, `reminderDelivery.test.ts`, `reminderHonesty.test.ts` | none | — | eng | — | YES |
| contacts | 90% | 85% | 🟢 | `familyContactsStorage.test.ts` | none | — | eng | — | YES |

**Persistence verdict: shippable.** RC7's "IndexedDB deferred (L-3)" is **stale** — it is implemented, wired, and e2e-passing.

---

## 3. FAMILY — 🟢 deterministic / 🟡 warmth

Source of truth: `knowledge/family_data.json` (21 people). Test personas Mor (daughter), Ofir (granddaughter), Gilad (Ofir's spouse), Ari (great-grandchild via Ofir+Gilad), plus grandchildren Ayalon/Eili/Adar/Adi/Noam.

| Gate | Current | Required | Color | Evidence | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|----------|----------------|------------|-------|-------------|-------|
| Mor | 95% | 90% | 🟢 | `familyReasoning.harness` 27/27; M-FAM-1/2 3.00/3 | none | — | eng | — | YES |
| Ari | 90% | 90% | 🟢 | great-grandchild 3-hop inference (S019, M-FAM-3) | none | — | eng | — | YES |
| Ofir | 90% | 90% | 🟢 | uncle/parent inference (F-13, M-FAM-4) | none | — | eng | — | YES |
| Gilad | 90% | 90% | 🟢 | spouse-of-Ofir resolved (`relationalResolver`) | none | — | eng | — | YES |
| grandchildren | 90% | 90% | 🟢 | `rc3FamilyReasoning.test.ts`, `familyGraph.ts` | none | — | eng | — | YES |
| aliases | 95% | 90% | 🟢 | `familyResolve.test.ts` (מורי→Mor, partner alias→Yael) | none | — | eng | — | YES |
| inferred relations | 90% | 90% | 🟢 | great-grandmother/uncle inferred (F-13) | edge cases beyond direct hops untested | breadth | eng | add 2-hop+ edge cases | YES |
| unknown-relation safety | 75% | 90% | 🟡 | safety-first fallback exists (`relationalResolver`, `familyTone`) | no explicit "honest: I don't know that relation" assertion isolated | coverage gap | eng | add explicit unknown-relation test | YES (low risk) |
| Martita perspective | 90% | 90% | 🟢 | "הבת שלך" not objective; `familyTone.test.ts`, `martitaPersona.test.ts`; RC6 transcripts speak in her POV | warmth of phrasing is stub in RC6 | real-model prose unproven | eng | validate in pilot | YES (facts) |

**Family verdict: facts shippable; warm phrasing unproven until real model + pilot.**

---

## 4. CALENDAR — 🟢

| Gate | Current | Required | Color | Evidence | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|----------|----------------|------------|-------|-------------|-------|
| read | 95% | 90% | 🟢 | `calendarProductionProof.test.ts` (today/tomorrow/week) | none | — | eng | — | YES |
| write | 95% | 90% | 🟢 | `service.test.ts` CRUD; e2e screenshots create/confirm passed | none | — | eng | — | YES |
| reminders | 95% | 90% | 🟢 | `reminderProduct.test.ts` (15-min med / 30-min default, snooze) | none | — | eng | — | YES |
| week queries | 90% | 90% | 🟢 | "מה יש לי השבוע" proven | none | — | eng | — | YES |
| previous-week | 90% | 85% | 🟢 | past-week read proven | none | — | eng | — | YES |
| before/after | 88% | 85% | 🟢 | F-05/F-06 fixed; `warRoom` T2b | bare-word time after לפני/אחרי needs ב-prefix (L-4) | `parseHebrewTimeDetailed` limit | eng | extend parser (P2) | YES |
| tomorrow / next-day | 95% | 90% | 🟢 | F-03 local-date fix; "ומה ביום הבא"→tomorrow (commit b250fcd) | none | — | eng | — | YES |
| save verification | 95% | 95% | 🟢 | readback `title+date+time` (F-07); `voiceReadbackGuard.test.ts` | none | — | eng | — | YES |
| fake-save prevention | 95% | 95% | 🟢 | `ConfirmCard.test.ts` (no silent save), `createPipelineIntegration.test.ts` | none | — | eng | — | YES |

**Calendar verdict: shippable.** Wrong-day and fake-save — the two highest-trust risks — are fixed and asserted.

---

## 5. CONVERSATION — 🟡 (deterministic green; live continuity unproven)

| Gate | Current | Required | Color | Evidence | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|----------|----------------|------------|-------|-------------|-------|
| follow-ups | 85% | 85% | 🟡 | `humanFollowUp.test.ts`, `followUpFixes.test.ts` (deterministic) | live multi-turn not run with real model | stub LLM in transcripts | eng | pilot Day-1 chains A/B/C | CONDITIONAL |
| pronouns | 88% | 85% | 🟢 | `pronounResolver.test.ts` (לנועם→לו) | none deterministic | — | eng | — | YES |
| short replies ("עליה") | 75% | 85% | 🟡 | covered in `martita100`/`contextResolver` | no isolated short-reply continuity test; live unproven | coverage + live gap | eng | pilot + add test | CONDITIONAL |
| topic continuity | 80% | 85% | 🟡 | `longContext.harness` 20/20; `martitaSimulation` topic-switch recovery (min 19–21) | live continuity across real LLM turns unproven | stub LLM | eng | pilot Day-1 chain A | CONDITIONAL |
| correction handling | 85% | 85% | 🟢 | `correctionParser.test.ts`; F-12 warm abort; "תמשיכי" clean-continuation (b250fcd) | live wording unproven | stub | eng | pilot chain D | YES (logic) |
| long conversation | 80% | 85% | 🟡 | `companionBrain.harness` 17/17; `longContext` 20/20 (deterministic) | 10–30 **real-LLM** turns never run (B-03 blocked) | no live scenario runner | eng | pilot Day-4/5 | CONDITIONAL |
| context after topic switch | 80% | 85% | 🟡 | `martita100` topic-switch journeys | live unproven | stub | eng | pilot | CONDITIONAL |

**Conversation verdict: the *machinery* (planner→suppression→continuity→composer) is proven deterministically; the *felt continuity with a real model* has never been executed.** This is a primary reason a supervised pilot is required before full production.

---

## 6. LANGUAGE — 🔴 Spanish / 🟡 Hebrew (real-model prose unproven)

| Gate | Current | Required | Color | Evidence | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|----------|----------------|------------|-------|-------------|-------|
| Hebrew | 70% | 85% | 🟡 | shaping proven (`shaperLang`, `familyTone`, `martitaPersona`); live smoke (deployed proxy) returned coherent warm feminine Hebrew | real-model warmth/naturalness never scored on rubric; RC6 prose is stub | live prose blocked by keys/no scenario runner (B-02) | eng/Leo | pilot Day-2/4 + score rubric | CONDITIONAL |
| Rioplatense Spanish | 45% | 85% | 🔴 | 4 scenarios specced (S039–042); register rules in Identity Spec | **ZERO executed Spanish transcripts**; raw live smoke replied in Hebrew to a Spanish prompt (no shaper); L-2 Spanish relational router is regex-only | no real Spanish run; `service.ts:429` Spanish path incomplete | eng/Leo | **must validate before relying on Spanish** (pilot Day-4) | NO (unproven) |
| mixed He/Es | 55% | 80% | 🟡 | `openCulture.test.ts`, `relationalResolver` mixed | single-turn mix untested; live unproven | gap | eng | pilot Day-4 | CONDITIONAL |
| tone | 70% | 85% | 🟡 | `personaTone.test.ts`, blacklist enforced (no "איך אפשר לעזור") | live tone unproven | stub | eng | pilot | CONDITIONAL |
| naturalness | 60% | 85% | 🟡 | `martita100` qualitative (deterministic) | no real-model naturalness gate | stub | eng | pilot | CONDITIONAL |
| non-patronizing | 80% | 90% | 🟢 | `productQA100.test.ts`, `service.test.ts` assert no patronizing phrases | live unproven | — | eng | pilot spot-check | YES (logic) |

**Language verdict: Hebrew likely good but unscored; Spanish is the single weakest real-user area — specified, essentially unexecuted.** Do not claim Spanish works until a real Spanish conversation is observed.

---

## 7. ONLINE — 🟢 (the one live-proven quality category)

| Gate | Current | Required | Color | Evidence (HIGH, this session) | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|------------------|----------------|------------|-------|-------------|-------|
| grounding | 90% | 85% | 🟢 | deployed `/api/abuai-online` → 200 with grounded answer **and real sources** (weather-atlas.com, wisemeteo.com) | — | — | eng | — | YES |
| freshness | 90% | 85% | 🟢 | returned "June 21/22, 2026" current weather via OpenAI Responses `web_search` | — | — | eng | — | YES |
| current facts | 88% | 85% | 🟢 | live web_search path returns current data | — | — | eng | — | YES |
| no fake online claims | 90% | 90% | 🟢 | `onlineHonesty.test.ts` (forbids "בדקתי/חיפשתי" without "לא"), `noHallucination.test.ts` | — | — | eng | — | YES |
| source discipline | 85% | 85% | 🟢 | `extractSources` returns url_citations; `onlineWiring.test.ts` personal-block gate | no explicit provenance-chain test | gap | eng | add provenance test | YES |

**Online verdict: shippable and live-proven.** Note: `realtimeCheapSourceRouter.ts` has a TODO (Open-Meteo not wired) but production weather flows through the proven `web_search` path, so this TODO is non-blocking.

---

## 8. TRUST — 🟢

| Gate | Current | Required | Color | Evidence | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|----------|----------------|------------|-------|-------------|-------|
| no fake save | 95% | 95% | 🟢 | `ConfirmCard.test.ts`, `createPipelineIntegration.test.ts` (F-04) | none | — | eng | — | YES |
| no raw JSON | 92% | 95% | 🟢 | `responseShaper.test.ts`, `truthGuard.test.ts` | none | — | eng | — | YES |
| no raw tool output | 92% | 95% | 🟢 | `companionRuntimeGuard.test.ts` (F-01: 22 paths routed through composer) | none | — | eng | — | YES |
| no raw provider errors | 88% | 95% | 🟡 | `answerCompiler.test.ts` (B2.3); warm error copy | no end-to-end provider-error→user-safe mapping test | gap | eng | add e2e error-mapping test | YES (low risk) |
| no invented relations | 92% | 95% | 🟢 | M-FAM-HONEST (honest no-invention); `relationalResolver` fallback | none | — | eng | — | YES |
| no wrong-day calendar | 95% | 95% | 🟢 | F-03 local-date fix; `warRoom` T2 | none | — | eng | — | YES |

**Trust verdict: shippable.** The hard-fail register (fake save, raw output, invented relation, wrong day) is comprehensively guarded deterministically.

---

## 9. VOICE — ⚪ LEO-ONLY (deterministic logic green; real device unproven)

| Gate | Current | Required | Color | Evidence | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|----------|----------------|------------|-------|-------------|-------|
| STT | 55% | 80% | ⚪ | `sttResilience.test.ts`, `recording.test.ts` (logic); health: `voiceTranscribe: client_direct_groq` | real mic→transcript never run headless | device-only | Leo | pilot Day-4 mic test | NO (unvalidated) |
| Realtime | 50% | 75% | ⚪ | `realtimeCheapSourceRouter.test.ts`, `realtimeVoice.ts` | real WebRTC realtime session unproven | device + live | Leo | pilot Day-4 | NO |
| TTS | 55% | 75% | ⚪ | Azure TTS key present; `reminderProduct` TTS+beep logic | real playback on Martita's device unproven | device-only | Leo | pilot Day-4 | NO |
| fallback | 60% | 80% | 🟡 | `voiceErrorMediation.test.ts`, `voiceTranscriptionFailureCopy.test.ts` | mic-denied→text fallback not e2e tested | gap | Leo/eng | pilot + add test | CONDITIONAL |
| mic | 40% | 80% | ⚪ | `micCapture.test.ts` (logic only) | real mic permission/capture unproven | device-only | Leo | pilot Day-4 | NO |
| device validation | 30% | 80% | ⚪ | none on Martita's actual device | never run on target device (Galaxy S25 / her phone) | requires Leo+device | Leo | pilot Day-1 supervised | NO |

**Voice verdict: NOT production-validated.** All deterministic logic (resilience, error mediation, pipeline P0, routing) is green, but **no real audio path has been exercised**. This is Leo-device work and a core pilot objective.

---

## 10. MARTITA EXPERIENCE — 🔴 (unproven — requires the pilot)

| Gate | Current | Required | Color | Evidence | Known failures | Root cause | Owner | Next action | Ship? |
|------|---------|----------|-------|----------|----------------|------------|-------|-------------|-------|
| human feeling | 35% | 80% | 🔴 | specified (Identity Spec §3/§7, 100 scenarios) | never observed with real model/user | stub LLM, no pilot | Leo | pilot | NO |
| companion feeling | 35% | 80% | 🔴 | architected (presence>problem-solving, memory-led openers) | no real transcript; RC6 prose is stub | no live run | Leo | pilot Day-1 | NO |
| emotional intelligence | 40% | 80% | 🔴 | grief/loneliness/worry suppression rules proven deterministically (S076–100) | real-model emotional prose never scored | stub | Leo | pilot Day-4/5 | NO |
| boredom / loneliness | 40% | 80% | 🔴 | "משעמם לי"→companionship frame (deterministic) | real warmth unproven | stub | Leo | pilot Day-4/5 | NO |
| proactive but not annoying | 45% | 80% | 🟡 | `proactive.ts`/`proactiveWiring.test.ts` (deterministic gating) | real-cadence tolerance unknown | no pilot | Leo | pilot observe | NO |
| real-user satisfaction | 0% | 80% | 🔴 | **none** — Martita has never used it | not measured | no pilot yet | Leo+Martita | run the pilot | NO |

**Martita Experience verdict: this is the whole point of the product and it is unproven.** A supervised pilot is the only instrument that can move these numbers.

---

## 11. OVERALL PRODUCTION SCORE

| Layer | Score | Basis |
|-------|-------|-------|
| Engineering + deterministic floor | **~95%** | build/tsc/4547 tests/persistence e2e/online live — all executed |
| Real-user / live-model / voice / Spanish / Martita | **~40%** | mostly specified or stub-only; online is the lone live-proven quality category |
| **Blended production-validated score** | **~72%** | strong floor, unproven ceiling |

> **72% is honest, not green.** The product cannot be called production-ready because the things Martita actually feels (warmth, Spanish, voice on her phone, satisfaction) are unproven. It IS ready to be put in front of Martita **under supervision** to prove or break exactly those things.

---

## 12. PRODUCTION BLOCKERS — SORTED BY MARTITA IMPACT

### P0 — would break trust / safety the moment she hits them
| ID | Failure | Why it matters to Martita | Root cause | Fix type | Next command / retest | Expected gain |
|----|---------|---------------------------|------------|----------|------------------------|---------------|
| **P0-1** | Voice/STT/mic never validated on a real device | Voice is her primary modality; if the mic path 404s/401s or returns raw errors, the app is unusable for her | no device run | voice / Leo-only | Leo: open deploy on her phone, tap voice, speak Hebrew (Retest chain F) | unblocks Voice 30→80% |
| **P0-2** | Rioplatense Spanish essentially unexecuted | She speaks Spanish; a wrong-register or Hebrew-only reply to a Spanish turn breaks the "knows me" feeling | no real Spanish run; L-2 router regex-only | logic + prompt | Leo: run `contame de Leo` / `¿quién es la hija de Mor?` on deploy (Retest, Spanish) | unblocks Spanish 45→80% |
| **P0-3** | Companion warmth / emotional prose only ever produced by a stub | If the real model is flat or robotic on grief/loneliness, she feels a chatbot, not Abu | live prose never scored (B-02/B-03) | prompt / live | Leo: run grief+loneliness turns on deploy, judge against Identity §7 | unblocks Experience 35→80% |

### P1 — correctness/quality risks that need a decision or a real run
| ID | Failure | Why it matters | Root cause | Fix type | Next command / retest | Expected gain |
|----|---------|----------------|------------|----------|------------------------|---------------|
| **P1-1** | **Pepe's memorial date contradiction**: `family_data.json` = `01-01`; `.claude/rules` = `12-26` | Pepe's memorial is emotionally sacred; a wrong date is a deep, hurtful error | unreconciled data (L-1) | data / Leo decision | **Leo: confirm correct date**, then align `family_data.json` ↔ rules and run `npm run generate:memory` | removes a P1 emotional-trust landmine |
| **P1-2** | Live multi-turn continuity (chains A/B/C) never run with real model | "She told it X, it forgot" is the fastest way to lose her | no live scenario runner | logic / live | Leo: run Retest chains A,B,C on deploy | Conversation 80→90% |
| **P1-3** | `Yarden` contradiction in `birthdays_registry.yaml` | wrong birthday/relation surfaced as fact erodes trust | hand-maintained `memory/*` (L-5) | data / human-approval | Leo: reconcile registry (HUMAN_APPROVAL to edit `memory/*`) | family data integrity |

### P2 — degradations / polish (not pilot-blocking)
| ID | Failure | Why it matters | Root cause | Fix type | Next command / retest | Expected gain |
|----|---------|----------------|------------|----------|------------------------|---------------|
| **P2-1** | `generateLLMSummary` posts wrong proxy contract → always falls back to pattern summary | weaker long-conversation memory summary | `service.ts:146` sends `{model,messages}` not `{body,lang,stream}` | logic | fix payload to `{body:{…},lang,stream:false}`; assert via `service.test.ts` | better long-context recall |
| **P2-2** | Bare-word time after לפני/אחרי ("אחרי ארבע") | occasional calendar parse miss | `parseHebrewTimeDetailed` (L-4) | logic | extend parser + `boundaryTime.test.ts` | Calendar before/after 88→95% |
| **P2-3** | `realtimeCheapSourceRouter` Open-Meteo fetcher is a TODO | none in practice (weather uses proven web_search) | unfinished cheap-source path | logic | wire Open-Meteo OR delete dead branch | cost optimization only |
| **P2-4** | `aiSpendGuard` counters don't survive reload | spend cap resets on reload | TODO in `aiSpendGuard.ts` | logic | persist counter via `durableStore` | spend-cap robustness |
| **P2-5** | Unknown-relation safety has no isolated assertion | small risk of an unsafe relation answer | coverage gap | logic/test | add explicit "honest unknown relation" test | Family 75→90% |

---

## 13. ACCEPTANCE PLAN — 7-DAY MARTITA SUPERVISED PILOT

**Pre-flight (before Day 1):** resolve **P1-1 memorial date** (data correctness is non-negotiable on emotional dates); confirm deploy URL opens on Martita's phone; confirm voice permission prompt appears.

| Day | Activity | Exact pass criteria | Fail = stop/fix |
|-----|----------|---------------------|------------------|
| **Day 1** | 10-min supervised first session (Leo present). Free chat + 1 family + 1 calendar + 1 voice tap | App loads on her phone; she completes ≥1 real exchange unaided; voice tap transcribes ≥1 Hebrew utterance; **zero** raw errors/JSON shown; **zero** fake-save | any hard-fail (P0-1) → fix before Day 2 |
| **Day 2** | Family + knowledge retest (text) — Retest chains A & B | All relations correct from her POV ("שלך"); great-grandchild inferred; no data-dump; history thread continues | wrong relation / lost thread → P1-2 |
| **Day 3** | Calendar retest (text+voice) — Retest chain C | Create→readback→"קבעתי"; tomorrow/next-day correct; **no fake-save**; correct day every time | fake-save or wrong day → STOP (P0/trust) |
| **Day 4** | Voice + Spanish + first emotional scenarios — Retest chains E & F + Spanish turns | STT works on her device; realtime OR quiet fallback (no noisy retries); Spanish replies in **Rioplatense**, real content; grounded weather/news or honest "לא מצליחה" | mic broken (P0-1) / Spanish wrong (P0-2) → fix |
| **Day 5** | Emotional intelligence depth (grief/loneliness/Papi) | Presence not problem-solving; suppresses lookups during emotion; tone warm, non-patronizing; "ja ja" not "חחח"; Papi never clinically profiled | flat/robotic/patronizing → P0-3 |
| **Day 6** | Bug-fix verification — re-run only the chains that failed Days 1–5 | Each previously-failed chain now passes its criteria; full `npm run check` still 4547/0 | any regression → not ready |
| **Day 7** | **Go / No-Go** | ALL P0 cleared; ALL P1 resolved or accepted-with-mitigation; Martita says (unprompted) she'd use it again | otherwise → NOT_READY, schedule fix cycle |

**Pilot-wide hard-fails (any single occurrence = not production):** fake calendar save · invented current fact · wrong family relation · raw JSON/tool/provider text shown · "שלי"/"ל-Martita" spoken to her (must be "שלך") · wrong memorial/birthday date · patronizing/childish tone.

Reference protocol already in repo: `docs/abuai/LEO_RETEST_SCRIPT.md` (chains A–F with exact prompts & criteria).

---

## 14. FINAL VERDICT (Run 2 — production closure)

### `READY_EXCEPT_LEO_AND_MARTITA_ONLY`

**Justification (honest):**
- Every code-, test-, data-, and harness-fixable blocker has been closed and **executed-green this run**: build green, typecheck clean, **4570/4570 tests** (+23), persistence e2e (IndexedDB + eviction), **online grounding/freshness live-proven**, the `generateLLMSummary` bug fixed, and new deterministic proofs for provider-error safety, unknown-relation safety, before/after bare-word reads, Rioplatense **shaping**, 20-turn continuity, and voice key safety.
- The only remaining items are exclusively **Leo-device** (mic/realtime/TTS on Martita's phone), **Martita-only** (real-model warmth, real Spanish, companion feeling, satisfaction), and **two Leo factual decisions** (`LEO_DATA_DECISIONS.md` D-1 memorial date, D-2 Yarden label).

**This is explicitly NOT a claim of full production readiness.** Deterministic Spanish *shaping* is proven, but **conversational Spanish, companion warmth, and voice on a real device are unproven (blended ~78%)** and are NOT marked green. The 10-minute supervised pilot (`LEO_FINAL_PILOT_SCRIPT.md` → `MARTITA_PASS_FAIL_SCORECARD.md` → `FINAL_GO_NO_GO.md`) is the only instrument that can move them. Full production may be claimed only after a passing pilot.

_(Run 1 verdict was `READY_FOR_MARTITA_SUPERVISED_PILOT` at ~72%. Run 2 closed the code-side gaps → `READY_EXCEPT_LEO_AND_MARTITA_ONLY` at ~78%.)_

---

### Final output summary

1. **Dashboard created:** `docs/abuai/PRODUCTION_ACCEPTANCE_DASHBOARD.md` (this file).
2. **Current production score:** **~72% blended** (engineering/deterministic ~95%; real-user/live/voice/Spanish ~40%).
3. **Top 10 blockers:** P0-1 voice/mic on real device · P0-2 Rioplatense Spanish unexecuted · P0-3 companion/emotional warmth stub-only · P1-1 Pepe memorial date contradiction (01-01 vs 12-26) · P1-2 live multi-turn continuity unrun · P1-3 Yarden registry contradiction · P2-1 summary proxy-contract bug · P2-2 לפני/אחרי bare-time parse · P2-3 Open-Meteo TODO · P2-4 spend-guard not persisted.
4. **Exact next action for Leo:**
   - (a) Decide & reconcile **Pepe's memorial date** → edit `knowledge/family_data.json` → `npm run generate:memory`.
   - (b) On Martita's phone, open the deploy URL and run `docs/abuai/LEO_RETEST_SCRIPT.md` chains **A–F** (incl. Spanish turns and the mic chain).
   - (c) Test against the **deployed** URL, not local `vercel dev` (local Edge emulation 500s on Node 24 — not a code bug).
5. **Final verdict:** `READY_FOR_MARTITA_SUPERVISED_PILOT` — **not** full production until the 7-day pilot returns Day-7 Go.
</content>
</invoke>
