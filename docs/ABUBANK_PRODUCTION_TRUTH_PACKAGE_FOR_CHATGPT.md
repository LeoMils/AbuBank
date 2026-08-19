# AbuBank / AbuAI — Production Truth Package (for ChatGPT + the repo)

Source-of-truth, evidence-graded. Every claim is tagged with evidence strength:
**[RUN]** executed command/test/eval output · **[EVAL]** eval-engine result ·
**[CODE]** file exists / wired (verified read) · **[GREP]** static source match = MEDIUM ·
**[NON-CODE]** not provable in code · **[UNKNOWN]**.

Snapshot: version **0.8.8-eval-judge** · branch `rc5/cognitive-architecture-and-acceptance`
(NOT merged to main) · HEAD `b750e7b`. Live deploy
`https://abu-bank-kiidpho8f-leos-projects-d3c04c09.vercel.app` → root 200, chat 200,
online 200, `OPENAI_API_KEY` present, `realtime-token` = `REALTIME_PROVIDER_FAILED` **[RUN]**.

---

## 1. EXECUTIVE PRODUCTION VERDICT

**Is AbuAI code-production-ready?** YES for the deterministic companion + a validated
voice fallback, shipped as a PWA. NO for "full voice production" — that is gated on a
physical iPhone test and the Realtime provider, both NON-CODE.

- **GREEN (code-proven):** build, typecheck, full test suite (198 files / **5984 tests** **[RUN]**),
  calendar intelligence, calendar Spanish + Hebrew, family graph facts, memory persistence,
  conversation continuity/repair, online routing, error recovery (localized), companion tone
  (no menu/fake-life/Fahrenheit/URL), voice **text** shaping, mobile/PWA build, no exposed
  secrets, eval (1095 cases @ **100%**) + separate judge (69 candidates @ **100/100**) **[EVAL]**.
- **YELLOW:** LLM *answer prose* quality (the natural family/emotional sentence the model
  generates at runtime) — the deterministic scaffolding around it is green, but the prose
  itself is only judgeable by a live separate model (judge prompt ready, not yet run live).
- **RED:** none in code.
- **NON-CODE:** physical iPhone microphone/TTS *sound* + on-device latency; Realtime provider
  availability (currently down).
- **What prevents full production today:** (1) Leo has not run the on-device voice test;
  (2) the Realtime provider returns `REALTIME_PROVIDER_FAILED` (account/quota). Neither is a
  code defect; the pipeline TTS/STT fallback is validated and ships.

---

## 2. PRODUCT REALITY

- **AbuBank** — a Hebrew/RTL PWA "portal" home for Martita: a calm, premium grid of services,
  family, and daily help. Senior-first (≥48px targets, ≥16px text, no scroll on primary screens).
- **AbuAI** — the companion inside it: voice + text, Hebrew + Rioplatense Spanish, that listens,
  remembers, schedules, checks online, and explains honestly.
- **Martita** — 80+, non-technical, Kfar Saba. Hebrew (with characteristic patterns) + Rioplatense
  Spanish. Family is everything; Friday dinners sacred; Pepe's memory tender; the "Ja ja ja" laugh
  is hers. Source of truth: `CLAUDE.md`, `knowledge/martita_personality.yaml`, `memory/`.
- **AbuAI must feel like:** a warm, smart, familiar friend — short, natural, adult, present;
  one useful next move, not a menu.
- **AbuAI must never feel like:** an assistant/menu, a caregiver, a therapy-bot, a child; it must
  never invent a personal life, never read URLs/markdown/Fahrenheit/raw blocks aloud, never say
  "I can't" without a reason + recovery, never loop a generic refusal.
- **"Production-ready" here means:** the deterministic companion behaves correctly for the real
  user moments (proven by tests + eval + judge), a safe voice fallback ships, no secrets leak, and
  the only open items are honest NON-CODE device/provider gates.

---

## 3. CURRENT ARCHITECTURE WITH EVIDENCE

Pipeline: input → normalize/STT-recovery → understanding (`orchestrate`) → Conversation Brain
(`planTurn`, goals/actions) → Conversation OS (continuation/repair/online memory) → tools
(calendar/online/family/memory) → Companion Experience Enforcer → Spoken Persona → TTS.

| System | Files | Main fns | Evidence | Maturity | Risk | Missing |
|---|---|---|---|---|---|---|
| AbuAI core convo | `src/screens/AbuAI/index.tsx`, `service.ts` | `streamMessage`, `sendMessage`, voice handler | chat 200 **[RUN]**; suite **[RUN]** | High | LLM prose = live-only | live prose quality |
| Conversation Brain | `conversationBrain.ts` | `planTurn` (goal/action/domain) | `conversationBrainQuality.test.ts` 722 **[RUN]** | High | — | — |
| Conversation OS | `conversationOS.ts` | continuation cache, repair, online memory | `conversationOperatingSystem.test.ts` **[RUN]** | High | — | — |
| Calendar | `calendarCreate.ts`, `meetingIntelligence.ts`, `eventExtractor.ts` | `understandMeeting`, `startCreate`, `resolvePendingMessage` | eval calendar 996/996 **[EVAL]** | High | NLP edge phrasings | rare phrasings |
| Memory persistence | `src/services/durableStore.ts` | `durable` (IndexedDB, migration-aware) | `durableStore.test.ts`, persistence e2e **[RUN]** | High | IDB unavailable in node eval | — |
| Family graph | `familyGraph.ts`, `knowledge/family_data.json` | `loadGraph` | eval family 165/165 + `validate:family` **[RUN]** | High | — | — |
| Hebrew | `spokenPersona.ts`, `voiceShaper.ts` | `toSpokenText` | eval hebrew 180 + judge **[EVAL]** | High | — | — |
| Spanish | `calendarCreate.ts`, `companionComposer.ts` | es intent/date/time, es fallback | eval spanish 162 + judge **[EVAL]** | High | accent/STT drift | accent variance |
| Emotional layer | `companionPlanner.ts`, `companionComposer.ts`, `companionExperience.ts` | `planCompanionTurn`, `enforceCompanion`, `hasFabricatedLife` | judge emotional 100/100 **[EVAL]** | High (det) / Med (LLM) | LLM depth | live depth |
| Online answers | `onlineIntent.ts`, `onlineProvider.ts`, `api/abuai-online` | `isOnlineCurrentInfoQuery`, `getOnlineQueryKind` | online 200 **[RUN]**; eval 87 **[EVAL]** | High (routing) | provider data quality | live result accuracy |
| Voice/STT/TTS/realtime | `src/services/voice.ts`, `voiceConfig.ts`, `api/realtime-token` | TTS chain (OpenAI→Azure→Gemini→WebSpeech), profiles | `finalVoiceExperience.test.ts` 207 **[RUN]**; realtime `REALTIME_PROVIDER_FAILED` **[RUN]** | High (text) / NON-CODE (audio) | device sound | physical audio |
| Error recovery | `service.ts` `chatTerminalFallback`, `serverChatProvider.ts` | localized he/es/en + offline | `chatFailureCopy.test.ts` 8 **[RUN]**; eval 96 **[EVAL]** | High | — | — |
| Mobile/PWA | `vite.config.ts` (VitePWA), `e2e/*` | manifest/SW | build exit 0 **[RUN]**; mobile-chrome e2e 2/2 **[RUN]** | High | iOS audio-unlock device-only | physical install/audio |
| Security/privacy | `.gitignore`, `.claude/rules/privacy-boundaries.md` | — | only `.env.example` tracked; no `sk-` in src/api **[RUN]** | High | log hygiene | — |
| Observability | `index.tsx` logs, diag panel | `[AbuAI][ORCH|BRAIN|LATENCY|VOICE|CONV_OS]` | grep present **[GREP]** | Med-High | needs device run | aggregation |
| Deployment | Vercel `abu-bank`, `api/*` | health/chat/online/stt/tts/realtime | health 200, buildVersion match **[RUN]** | High | realtime down | provider |

---

## 4. EVALUATION / JUDGE / REPLAY SYSTEM

- **Benchmark** (`src/screens/AbuAI/benchmarkConversations.ts`): 54 golden moments, runs the real
  pipeline, 100% **[RUN]**. The North-Star regression floor.
- **Eval Engine** (`src/eval/evalEngine.ts`): 10 capabilities × 8 dimensions; **1095 deterministic
  cases** at scale 3 (expandable to ~5000); seeds clean state; captures input/output/tools/calendar/
  memory/latency/errors. **NORTH_STAR = 100%** (deterministic dimensions passing) **[EVAL]**.
  Coverage: calendar 996, hebrew 180, family 165, spanish 162, emotional 147, continuity 111,
  error 96, online 87, voice 84, memory 18.
- **Judge** (`src/eval/judgeRunner.ts` + `judgePrompt.md`): a **SEPARATE rule judge — NOT AbuAI** —
  scores 69 *deterministic* prose candidates (companion fallback / continuation / repair /
  voice-shaped / failure copy) 0–100 on the rubric; **avg 100/100, 0 fail** **[EVAL]**. Marks
  low-confidence `uncertain`. LLM-generated *answer* prose has no in-code candidate → reported NON-CODE.
- **Regressions**: `detectRegressions` vs `docs/eval/baseline.json` (gitignored). Reports written to
  `docs/eval/`: `EVAL_REPORT.md`, `NORTH_STAR_SCORE.md`, `REGRESSIONS.md`, `TOP_FIXES_BY_ROI.md`,
  `judge-results.json`.
- **What each version changed** (`.claude/project_state/IMPACT_SCOREBOARD.md`):
  - 0.8.5 — Spanish calendar create (was 0% in her 2nd language → full create).
  - 0.8.6 — Spanish location (inline + pending merge).
  - 0.8.7 — Eval engine built; **found "sí, agendalo" not confirmed → fixed** (99.5→100%).
  - 0.8.8 — Separate judge + coverage to minimums; **found Spanish emotional fallback replied in
    Hebrew → fixed**; **found online gaps "מי שיחק"/"מתי שוקעת השמש" → fixed**.
- **Bugs eval/judge found & fixed:** (1) "sí, agendalo" not saved; (2) es emotional fallback in
  Hebrew; (3) online detection gaps. All shipped.
- **Untestable by code:** LLM live-answer prose depth; physical iPhone audio; Realtime provider.

---

## 5. PRODUCTION DASHBOARD

Color: 🟢 code-proven · 🟡 green-in-eval-not-live · 🔴 broken · ⚪ NON-CODE.
Production minimum = deterministic 100% (+ judge ≥95 for prose).

| Capability | Before eval work | Current | Prod min | Color | Evidence | Blocker | Owner | Next action |
|---|---|---|---|---|---|---|---|---|
| AI core conversation | working | det green; prose live-only | 100% det | 🟡 | chat 200, suite | live prose | code/external | run live judge |
| Calendar intelligence | green | 996/996 | 100% | 🟢 | EVAL_REPORT | — | code | — |
| Calendar Spanish | 0% | det green + judge | 100% | 🟢 | eval/judge | — | code | — |
| Calendar Hebrew | green | 996 incl. he | 100% | 🟢 | EVAL_REPORT | — | code | — |
| Memory persistence | green | durableStore + e2e | pass | 🟢 | persistence e2e | — | code | — |
| Memory retrieval | green | continuation/online memory | 100% | 🟢 | conv-os tests | — | code | — |
| Family graph | green | 165/165 + validate | 100% | 🟢 | validate:family | — | code | — |
| Emotional support | uncertain | route 100% + judge 100 | 100+≥95 | 🟢/🟡 | judge-results | LLM depth | code/external | live judge |
| Adult non-patronizing tone | uncertain | judge 100/100 | ≥95 | 🟢 | judge-results | — | code | — |
| Long continuity | uncertain | 111/111 + judge | 100+≥95 | 🟢 | EVAL_REPORT | — | code | — |
| Hebrew naturalness | green | 180 + judge | 100+≥95 | 🟢 | judge-results | — | code | — |
| Spanish naturalness | bug | 162 + judge | 100+≥95 | 🟢 | judge-results | — | code | — |
| Online routing | green(gaps) | 87/87 | 100% | 🟢 | EVAL_REPORT | live data quality | code/external | — |
| Voice text path | green | judge 100 | ≥95 | 🟢 | judge-results | — | code | — |
| Physical iPhone audio | — | not code-testable | device pass | ⚪ | — | device test | **Leo** | run device test |
| Realtime provider | down | `REALTIME_PROVIDER_FAILED` | live ok | ⚪ | realtime-token | quota/key | **account** | restore key |
| Error recovery | green | 96/96 he/es/offline | 100% | 🟢 | chatFailureCopy | — | code | — |
| Safety/privacy | green | no banned/fake-life; no secrets | 100% | 🟢 | git+grep | log hygiene | code | — |
| Mobile/PWA | green | build + mobile e2e | pass | 🟢 | e2e 2/2 | physical install | code/Leo | device test |
| Build/tests | green | tsc + 5984 + build exit 0 | pass | 🟢 | RUN | — | code | — |
| Deployment | green | 0.8.8 root/chat/online 200 | 200 | 🟢 | RUN | not merged to main | code/Leo | merge decision |
| Observability | partial | structured logs + diag | present | 🟡 | GREP | needs device run | code/Leo | device capture |
| Eval/replay/judge | new | 1095@100% + 69 judge@100 | gates pass | 🟢 | EVAL | live judge pending | code | live judge |
| Production Control Tower | not built | spec only (§10) | dashboard live | 🔴/none | — | not built | code | build if needed |

---

## 6. FALSE CONFIDENCE AUDIT (how it could look green and still fail)

- **Judge is rule-based**, not a live LLM — it verifies objective rubric criteria (banned/menu/
  fake-life/language/length/warmth) but **cannot judge genuine emotional depth or subtle
  naturalness** of an LLM sentence. Green judge ≠ "the live model's answers are warm."
- **Deterministic eval runs the deterministic pipeline**, not the live LLM — it does NOT exercise
  Groq/OpenAI prose, network timing, or token streaming. Green eval ≠ live conversation quality.
- **LLM live answers are unverified** in CI — tone/accuracy of `streamMessage` output depends on the
  prompt + model at runtime; enforcers clean banned register but cannot inject warmth.
- **Physical iPhone audio is NON-CODE** — STT capture, TTS *sound*, audio-unlock, and real latency
  are unproven; tests only assert code paths/diagnostics.
- **Realtime provider is down** — "realtime works" is false today; only the pipeline fallback works.
- **Calendar state** — multi-day, recurring, and timezone edges are partial; "3:00" defaults assume
  meeting context; unusual phrasings may mis-parse.
- **Memory/state contamination** — eval seeds clean state each run; in a long real session, stale
  pending-create or conversation-OS cache could mis-fire if not cleared (mitigated by park/clear,
  but not exhaustively fuzzed live).
- **UX / elderly-user risks** — font/contrast/scroll proven on 412×870 emulation only; real reading
  comfort, tap accuracy, and panic-recovery for an 80-year-old need a human session.
- **Language risk** — es detection is heuristic; mixed he/es turns and accent-dropped STT can misroute.
- **Deployment/env risk** — not merged to main; a missing/rotated `OPENAI_API_KEY` or provider quota
  silently degrades to fallback; `realtime` already degraded.

---

## 7. ABUAI CONSTITUTION — DRAFT INPUT

- **Identity:** Martita's warm, smart, familiar companion. Not an assistant, menu, caregiver, or AI persona.
- **Experience:** she should feel heard, remembered, and helped; one useful next move.
- **Tone:** warm, adult, direct, concise; feminine Hebrew address; Rioplatense Spanish when she uses it.
- **Language:** answer in HER language (he/es); never translated/robotic Hebrew; most UI is Hebrew by design.
- **Emotional:** listen, don't solve loneliness with tips; Pepe gentle; never fabricate a personal life.
- **Calendar:** confirm on any natural yes; "3:00"→15:00 unless night explicit; merge location; park
  unrelated turns; clean titles; never invent person/date/time.
- **Memory:** continue cached answers on "תמשיכי"; explain failures from the recorded reason.
- **Family:** facts from `knowledge/family_data.json` only; never contradict relationships.
- **Online:** route current-info; distinguish result vs schedule; on failure state the real reason + retry.
- **Uncertainty:** if unknown, say so; never guess a fact; mark uncertain.
- **Safety/privacy:** city-level only; no street/phone/medical/financial; store patterns not raw chats; no secrets in output.
- **Production:** no fake green; no "I can't" without reason+recovery; no menu; no URL/markdown/Fahrenheit aloud.
- **Never:** patronize, infantilize, loop a refusal, invent life, read raw blocks, abandon context.

---

## 8. ENGINEERING BIBLE — INPUT

- **Change code** via the smallest safe edit; reuse the pipeline; increment `src/version.ts` every change.
- **Run eval:** `npx vitest run src/eval/evalEngine.test.ts` (deterministic 100% floor + judge ≥95 floor).
- **Run judge:** `runJudge(judgeCandidates(scale))`; a SEPARATE judge — never AbuAI; live judge uses `judgePrompt.md` on a different model.
- **Regression:** `detectRegressions` vs `docs/eval/baseline.json`; raise the floor when score rises.
- **Gates:** `npm run typecheck` + `npm run test` + `npm run build` (no lint gate exists) + mobile-chrome Playwright. No green claim without a passing command.
- **Agents/skills:** `.claude/agents/*`, `.claude/skills/*`; war-room loop = NORTH_STAR → benchmark → highest-ROI → implement one → re-benchmark → IMPACT_SCOREBOARD → next.
- **Definition of done:** failing moment now passes via an executed assertion; full suite green; eval+judge green; state files updated.
- **Commit/release:** never weaken tests; never skip hooks unless asked; do NOT merge to main without sign-off; co-author trailer required.

---

## 9. MARTITA EXPERIENCE BIBLE — INPUT

- **Feel:** talking to a friend who knows her. **Forbidden tone:** menu, assistant, caregiver,
  therapy-bot, childish, patronizing, fake-sweet.
- **Bad → Good:**
  - "אפשר לדבר איתי, לשאול משהו, או לבקש שאקבע…" → "ערב טוב, Martita. אני איתך."
  - "פאפי היה מיוחד. את רוצה לספר לי עליו? איך אפשר לעזור?" → "כן… פאפי באמת חסר. אני איתך רגע."
  - weather raw block + Fahrenheit + URL → "מחר בכפר סבא נעים, בערך 22 עד 30 מעלות."
  - "אין לי אפשרות לבדוק את זה עכשיו." → "ניסיתי לבדוק וזה נפל לי. אנסה שוב או אמשיך ממה שכבר הבאתי."
  - calendar "שלוש בלילה" for a meeting → 15:00, or ask "שלוש אחר הצהריים?"
- **Spanish:** "estoy sola" → "Estoy con vos." ; "agendá una reunión con Gabi mañana a las tres" → saves Gabi/tomorrow/15:00.
- **Family:** "מי זאת מור" → her daughter, correct relationships from data.
- **Memory:** "תמשיכי" → continues the prior answer, never restarts.

---

## 10. PRODUCTION CONTROL TOWER — SPEC (build only if needed)

- **Data sources (JSON):** `docs/eval/judge-results.json`, `docs/eval/baseline.json`, and a new
  `docs/eval/dashboard.json` emitted by the eval test (capability → {deterministic%, judge, color,
  owner, blocker, nextAction, evidence}).
- **Route:** an internal `/admin` or static `docs/eval/dashboard.html` reading `dashboard.json`
  (no new runtime surface for Martita).
- **Color rules:** 🟢 deterministic 100% AND (judge ≥95 OR no prose dim); 🟡 green-in-eval but live
  unverified; 🔴 any deterministic fail; ⚪ NON-CODE (device/account).
- **Owner/action fields:** owner ∈ {code, Leo, account, external}; nextAction = the top
  `TOP_FIXES_BY_ROI` entry or the NON-CODE owner action.
- **Next-action algorithm:** if any 🔴 → fix highest-ROI failing (capability·dimension); else if any
  🟡 with a code path → run live judge / add cases; else → the single NON-CODE owner action.
- **Tests required:** the eval test must emit `dashboard.json` and assert schema; a contract test that
  no capability is 🟢 unless its evidence file shows a pass.
- **Never green:** physical iPhone audio without device evidence; Realtime without a live `ephemeral`
  token; any capability whose only evidence is `[GREP]`.

---

## 11. SINGLE NEXT ACTION

**Run the on-device iPhone voice test (Leo) per `docs/abuai/LEO_COMPANION_BREAKTHROUGH_RETEST.md`.**
Rationale: every code-testable area is GREEN (5984 tests; eval 1095@100%; judge 69@100/100; deploy
healthy). The two real blockers are NON-CODE — physical audio (Leo) and the Realtime provider
(account). The highest-ROI step toward *real* production is the device test, because it is the only
thing that can validate the one capability code cannot prove (physical voice) and unblock the GO
decision. Parallel account action: restore the Realtime provider key/quota in Vercel env.
