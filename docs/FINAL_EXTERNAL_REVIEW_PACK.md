# AbuBank / AbuAI — Final External Review Pack (for Codex / ChatGPT)

Evidence tags: **[RUN]** executed command/test · **[EVAL]** eval-engine · **[CODE]** file
verified · **[GREP]** static match (MEDIUM) · **[NON-CODE]** external/device/account ·
**[UNKNOWN]**. Do not accept any 🟢 without its evidence tag.

---

## 1. Executive verdict
- **Version** `0.9.0-production-closure` · **branch** `rc5/cognitive-architecture-and-acceptance`
  (NOT merged to main) · HEAD `1c69df2` **[RUN]**.
- **Deploy** (preview) `https://abu-bank-1q1s2eynq-leos-projects-d3c04c09.vercel.app` →
  root 200, chat 200, online 200, `OPENAI_API_KEY` present, `realtime-token` =
  `REALTIME_PROVIDER_FAILED` **[RUN]**.
- **Production status:** CODE PRODUCTION READY for a PWA beta with a validated voice
  fallback. Full "voice production" is gated on NON-CODE items.
- **Green (code-proven):** build, tsc, **5984 tests** [RUN]; eval **1095 cases @ 100%** +
  judge **69 @ 100/100** [EVAL]; calendar/he/es/family/memory/continuity/online/error/tone/
  voice-text/PWA/no-secrets/knowledge-validation.
- **Non-code:** physical iPhone audio (Leo); Realtime provider (account); live LLM *answer
  prose* depth (separate live judge).
- **Exact blockers to full production:** (1) on-device voice test not run; (2) Realtime
  provider down. Neither is a code defect.

---

## 2. Full application map
- **AbuBank screens** (`src/screens/`): Home, AbuAI, AbuWhatsApp, Settings, AbuGames,
  AbuCalendar, Opening/Offline/Error/Admin. Enum in `src/screens` + `product.yaml`.
- **AbuAI modules** (`src/screens/AbuAI/`): `index.tsx` (UI + voice/text handlers),
  `service.ts` (LLM chat/stream + terminal fallback), `understandingOrchestrator.ts`,
  `conversationBrain.ts` (planTurn), `conversationOS.ts` (continuation/repair/online memory),
  `calendarCreate.ts`, `meetingIntelligence.ts`, `eventExtractor.ts`, `familyGraph.ts`,
  `onlineIntent.ts`, `onlineProvider.ts`, `companionPlanner.ts`, `companionComposer.ts`,
  `companionExperience.ts`, `spokenPersona.ts`, `voiceShaper.ts`, `router.ts` **[CODE]**.
- **AbuCalendar** (`src/screens/AbuCalendar/`): calendar + `reminders/` (reminderParser,
  reminderStore, reminderDelivery) **[CODE]**.
- **Knowledge system** (`knowledge/`): `family_data.json` (source), `family/people/*.yaml`
  (generated), `product.yaml` / `behavior.yaml` / `production_rules.yaml` /
  `abuai_identity.yaml`, `KNOWLEDGE.md` manifest **[CODE]**.
- **Eval system** (`src/eval/`): `evalEngine.ts`, `judgeRunner.ts`, `judgePrompt.md`,
  `evalEngine.test.ts`; reports in `docs/eval/` **[CODE]**.
- **API routes** (`api/`): `abuai-chat.ts`, `abuai-online.ts`, `abuai-stt.ts`,
  `abuai-tts.ts`, `realtime-token.ts`, `health.ts` **[RUN: ls api/]**.
- **Deployment:** Vercel project `abu-bank`, serverless `/api/*`.
- **PWA/mobile:** `vite-plugin-pwa` (`vite.config.ts`); e2e mobile-chrome 412×870.

---

## 3. AbuAI architecture (full flow)
`input → normalize/STT-recovery → language detect → intent/domain routing → memory/family/
calendar/online/emotional → Brain/orchestration → response shaping → voice/TTS/STT/realtime/
fallback → observability.`

| Stage | Files / fns | Evidence | Maturity | Risk |
|---|---|---|---|---|
| Normalize / STT recovery | `understandingOrchestrator.ts` normalizeInput; `sttSemanticRecovery.ts` | orchestrator tests [RUN] | High | STT drift he/es |
| Language detect | `proactive.ts` detectLanguage; `companionPlanner.ts` plan.lang | judge es-fallback [EVAL] | Med-High | heuristic, mixed-lang |
| Intent/domain routing | `conversationBrain.ts` planTurn; `router.ts`; `onlineIntent.ts` | brainQuality 722 [RUN]; eval [EVAL] | High | name/topic collisions (fixed ירדן) |
| Memory/family/calendar/online/emotional tools | `conversationOS.ts`, `familyGraph.ts`, `calendarCreate.ts`, `onlineProvider.ts`, `companionPlanner.ts` | eval per-capability [EVAL] | High | live data quality |
| Brain / orchestration | `understandingOrchestrator.ts` orchestrate; `service.ts` streamMessage | chat 200 [RUN] | High (det) / Med (LLM) | LLM prose |
| Response shaping | `companionComposer.ts` enforceCompanion; `companionExperience.ts`; `spokenPersona.ts` toSpokenText; `voiceShaper.ts` | judge 100/100 [EVAL] | High | — |
| Voice / TTS / STT / realtime / fallback | `src/services/voice.ts`, `voiceConfig.ts`, `api/*` | text path tested; realtime down [RUN] | High (text) / NON-CODE (audio) | device/provider |
| Observability | `index.tsx` `[AbuAI][ORCH|BRAIN|LATENCY|VOICE|CONV_OS]`; diag panel | grep present [GREP] | Med-High | needs device run |

---

## 4. Voice stack deep review

### Current (direct-provider fetch — no AI SDK) [CODE]
- **STT:** WebSpeech (browser) primary; Groq server (`api/abuai-stt.ts`) fallback. Health
  reports `voiceTranscribe: client_direct_groq`.
- **TTS:** chain in `src/services/voice.ts` — OpenAI `gpt-4o-mini-tts` voice `shimmer`
  (rate 0.95, warm instructions) → Azure `HilaNeural` → Gemini → Web Speech (emergency,
  logged `WEB_SPEECH_FALLBACK_BAD_QUALITY_RISK`). Config: `src/services/voiceConfig.ts`
  (`VOICE_PROFILES`, `MARTITA_VOICE_STYLE`).
- **Realtime:** `api/realtime-token.ts` mints an ephemeral token; currently returns
  `REALTIME_PROVIDER_FAILED` **[RUN]**. Runtime skips realtime for 5 min on failure and uses
  the pipeline (quiet fallback, `index.tsx`).
- **iPhone/PWA audio path:** iOS secure-context + audio-unlock guards; `unlockIOSAudio`.
  Physical behavior = **NON-CODE**.
- **Latency logging:** `[AbuAI][LATENCY]` (TRANSCRIPT_TO_RESPONSE_MS … TOTAL_TAP_TO_SPEAK_MS,
  ONLINE_FETCH_MS) + `[AbuAI][VOICE]` (VOICE_PROFILE_USED/TTS_*/FALLBACK_REASON).
- **Failures observed:** Realtime provider down (account); physical audio unverified.
- **Env vars:** `VITE_OPENAI_API_KEY`, `VITE_AZURE_TTS_KEY`, `VITE_GEMINI_API_KEY`,
  `VITE_GROQ_API_KEY` (client), server `OPENAI_API_KEY` **[RUN]**.
- **Tests/evals:** `finalVoiceExperience.test.ts` (207), voice judged 100/100 [EVAL];
  physical audio NOT covered.

### Vercel AI Gateway / AI SDK 7 (external, some beta) [UNKNOWN where marked]
Capabilities (per Vercel docs, reviewer to confirm current state):
- Unified **provider routing** + failover across model providers.
- **STT / TTS** via AI SDK `experimental_transcribe` / `experimental_generateSpeech`.
- **Realtime voice** / `useRealtime` / `experimental_realtime` — [UNKNOWN] maturity/beta.
- **Observability** (traces, token/latency), **spend controls**, **BYOK**.
- **Beta risk:** realtime + speech APIs are newer/experimental; API churn likely.
- **Repo state:** NO `ai` / `@ai-sdk` / Vercel AI packages installed **[RUN]** — adoption is
  net-new dependency + refactor (and `package.json` changes are gated in this repo).

### Recommendation options
| Option | Pros | Cons | Risk | Effort | Prod impact |
|---|---|---|---|---|---|
| A. Keep current | works; validated fallback; zero churn | manual provider chain; no built-in spend/obs | Low | 0 | ship now |
| B. Add Gateway as OPTIONAL provider (post-prod) | obs + spend controls + BYOK + failover; could fix Realtime reliability | new dep; integration/testing | Low-Med | Med | none now; upside later |
| C. Migrate voice to Gateway now | unified realtime path | beta churn; refactor before launch; no proven need | High | High | delays launch |
| D. Postpone until after production | ships now; revisit with data | Realtime stays down until account/Gateway | Low | 0 | ship now |

**Recommendation: D now + B after production.** Realtime is down for **account/quota**
reasons, not architecture — migrating voice (C) before launch is a speculative refactor that
the rules forbid unless the current path is objectively blocking (it is not; fallback ships).
Post-launch, evaluate the Gateway as an **optional provider (B)** specifically for Realtime
reliability + spend/observability. Confirm AI SDK 7 realtime maturity before committing.

---

## 5. Evaluation and production proof [RUN/EVAL]
- **Tests:** 198 files / **5984 passed / 0 failed**.
- **Eval cases:** **1095** deterministic (scale 3; ~5000 at scale 24). **NORTH_STAR = 100%**.
- **Judge:** **69** deterministic prose candidates, **avg 100/100, 0 fail** (separate rule
  judge, NOT AbuAI).
- **Coverage:** calendar 996, hebrew 180, family 165, spanish 162, emotional 147, continuity
  111, error 96, online 87, voice 84, memory 18.
- **Bugs eval/judge found & fixed:** "sí, agendalo" not confirmed; Spanish emotional fallback
  replied in Hebrew; online gaps "מי שיחק"/"מתי שוקעת השמש". All shipped.
- **What eval CANNOT prove:** live LLM answer prose depth; physical iPhone audio; Realtime
  provider; real network latency.

---

## 6. Knowledge system
- **Source of truth:** `knowledge/family_data.json` (runtime `familyGraph.ts` + `generate:memory`).
- **Generated:** `knowledge/family/people/*.yaml` (21) via `generate:knowledge`; `memory/*`.
- **YAML authorities:** product / behavior / abuai_identity / production_rules (each with
  `knowledge_domain` + `authority`), registered in `KNOWLEDGE.md`.
- **Validation:** `validate:family` (relationships) + `validate:knowledge` (authorities exist,
  domain single-ownership, per-person sync, no duplication) — both in `prebuild`. Negative test
  confirmed drift is caught **[RUN]**.
- **Skills:** `add-family-member`, `update-knowledge`.
- **Risks/future:** family remains JSON-source (no YAML parser installed → per-person YAML are
  generated views, not editable source); a YAML-source-of-truth would need a parser dep (gated).

---

## 7. Production readiness table
🟢 code-proven · 🟡 eval-green/live-unproven · 🔴 broken · ⚪ NON-CODE.

| Capability | Status | Score | Evidence | Owner | Blocker | Next action |
|---|---|---|---|---|---|---|
| Core conversation | 🟡 | det 100% | eval; chat 200 | code/external | live prose | live judge |
| Hebrew | 🟢 | 180+judge | eval/judge | code | — | — |
| Spanish | 🟢 | 162+judge | eval/judge | code | — | — |
| Calendar | 🟢 | 996/996 | eval | code | — | — |
| Reminders | 🟢 | pass | reminder tests | code | — | — |
| Memory | 🟢 | pass | durableStore e2e | code | — | — |
| Family | 🟢 | 165/165 | validate:family | code | — | — |
| Emotional tone | 🟢 | judge 100 | judge-results | code | LLM depth | live judge |
| Adult non-patronizing UX | 🟢 | judge 100 | judge-results | code | — | — |
| Online | 🟢 | 87/87 | eval | code | live data | — |
| Voice text path | 🟢 | judge 100 | judge-results | code | — | — |
| Physical iPhone audio | ⚪ | n/a | — | Leo | device | device test |
| Realtime provider | ⚪ | fail | realtime-token | account | quota/key | restore key |
| Mobile/PWA | 🟢 | 2/2 | Playwright | code/Leo | physical install | device test |
| Security/privacy | 🟢 | pass | git+grep | code | — | — |
| Observability | 🟡 | present | grep | code/Leo | device run | capture on device |
| Build/tests | 🟢 | 5984 | RUN | code | — | — |
| Deployment | 🟢 | 200 | curl | code/Leo | not merged | merge decision |
| Knowledge integrity | 🟢 | pass | validate:knowledge | code | — | — |
| Eval/judge/replay | 🟢 | 100/100 | eval | code | live judge | live judge |

---

## 8. False-confidence audit (green-but-could-fail)
- **Live LLM answer quality** — eval/judge never run the live model; warmth/accuracy of
  `streamMessage` output is unverified. Enforcers clean register but cannot inject warmth.
- **iPhone microphone/TTS** — sound, capture, audio-unlock, real latency all NON-CODE.
- **Realtime provider** — down now; "realtime works" is false until a live `ephemeral` token.
- **Elderly UX** — validated on emulation only; real reading/tap/panic-recovery need a human.
- **Hebrew/Spanish STT drift** — heuristic detection; accent-dropped STT + mixed-language misroute.
- **Calendar timezone/recurrence** — partial; "3:00" assumes meeting context; edges may mis-parse.
- **Memory contamination** — eval seeds clean state; long real sessions could carry stale
  pending-create/OS cache (mitigated by park/clear, not exhaustively fuzzed live).
- **Offline** — app shell precached; only the failure message is offline-aware; broader offline
  behavior lightly tested.
- **Deployment/env** — not merged to main; a missing key/quota silently degrades to fallback
  (already true for Realtime).
- **Judge limitations** — rule-based; verifies objective rubric criteria, NOT genuine emotional
  depth/subtlety; a green judge ≠ a warm live answer.

---

## 9. External reviewer instructions (questions for Codex/ChatGPT)
1. **Architecture:** Is the input→brain→OS→tools→shaping→voice pipeline sound for an 80+
   Hebrew/Spanish user? Any single point of failure or state-contamination risk?
2. **Security:** Any secret exposure, PII over-collection, prompt-injection, or unsafe logging?
   (Baseline: only `.env.example` tracked; no `sk-` in src/api.)
3. **Voice stack:** Is the OpenAI→Azure→Gemini→WebSpeech chain + quiet realtime fallback the
   right design? Is the 5-min skip + diagnostics adequate?
4. **Vercel AI Gateway / AI SDK 7:** Given Realtime is down for account reasons (not
   architecture), does the Gateway *clearly* beat the current path BEFORE production? Confirm
   AI SDK 7 realtime/STT/TTS maturity + beta risk. Recommend A/B/C/D with justification.
5. **Production readiness challenge:** Attack the 🟢 table — which capability is falsely green?
6. **Missing tests:** What real-user scenario is uncovered by 1095 eval cases + 5984 tests?
7. **Hidden risks:** Elderly UX, mixed-language, memory contamination, calendar edges — rank by
   real-world probability × harm.
8. **Final GO/NO-GO:** Given all evidence, is this GO-to-device-test, or HOLD for a code fix?

---

## 10. Final recommendation
**GO to device test.** Every code-testable capability is green with executed evidence; the only
open items are NON-CODE (physical audio = Leo; Realtime = account) and the live-LLM prose judge.
Do NOT migrate voice to Vercel AI Gateway before production — the current path is not blocking;
adopt the Gateway as an OPTIONAL provider AFTER launch (option B) to improve Realtime reliability,
spend control, and observability. Highest-ROI human step now: run
`docs/abuai/FINAL_HUMAN_ACCEPTANCE_TEST.md` on the iPhone.
