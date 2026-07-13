# ABUAI / ABUBANK — COMPLETE PROJECT HANDOFF TO CLAUDE

**Prepared for:** Leo Milstein  
**Project:** AbuBank / AbuAI  
**Repository:** `C:/Users/Lmilstein/ClaudeCode/Abu-Bank`  
**GitHub:** `LeoMils/AbuBank`  
**Primary branch:** `rc5/cognitive-architecture-and-acceptance`

## Purpose

This document transfers the product, engineering, operational, testing, recovery, and decision context needed to continue AbuAI without restarting, losing history, or repeating known mistakes.

---

# 1. Executive mandate

You are taking over the complete technical and product leadership of AbuBank and AbuAI.

You are responsible for product direction, AI architecture, realtime voice, STT, TTS, conversation quality, memory, family knowledge, calendar, online/current information, reliability, evaluation, Claude Code operations, release discipline, root-cause investigation, regression prevention, and device acceptance.

The only meaningful success condition is:

> **Martita can use AbuAI on a real iPhone and experience a natural, warm, fast, intelligent, trustworthy conversation that is as close as realistically possible to modern ChatGPT Voice.**

Do not optimize for number of commits, number of tests, amount of code, architecture elegance, or completion of tickets. Optimize for the real user experience.

---

# 2. User and product context

## Project owner

- Name: Leo Milstein
- Location: Israel
- Languages: Hebrew, English, Spanish
- Leo wants direct, professional, precise communication with no fluff.
- Leo is not a developer and needs exact operational instructions.
- Every report or prompt must end with one explicit next action.
- Never leave Leo wondering what to click, paste, run, or wait for.

## Primary user

The main user is Martita, an older woman who should be able to use AbuAI naturally by voice.

The experience must be warm, natural, patient, intelligent, concise, context-aware, non-robotic, non-patronizing, reliable, and easy to use without technical knowledge.

The system must support Hebrew and Spanish naturally, including switching between them.

## Core product goal

AbuAI is intended to behave like a deeply personalized conversational companion with access to family knowledge, memory, calendar, current online information, voice conversation, emotional support, personal context, and persistent knowledge.

The product must not feel like a menu system, IVR, scripted bot, or old voice assistant.

---

# 3. Non-negotiable P0 capabilities

1. Realtime voice
2. Accurate Hebrew STT
3. Accurate Spanish STT
4. Audible and natural TTS
5. Persistent memory
6. Working conversation memory
7. Family graph
8. Gender correctness
9. Calendar create/read/modify/delete
10. Online/current answers
11. Follow-up understanding
12. Correction handling
13. Mobile/PWA reliability
14. Diagnostics and health
15. Low latency
16. Natural conversation quality

No capability is complete merely because unit tests pass.

---

# 4. Family facts that must remain correct

- Martita is the primary user.
- Mor is Martita’s daughter.
- Mor’s partner is Yael.
- Mor lives in Hod HaSharon.
- Mor has four children: Ofir, Ayalon, Eili, Adar.
- Ofir is female.
- Mor is divorced from Rafi/Raphi.
- Ofir is Martita’s granddaughter, not grandson.
- Hebrew references to Ofir must always use female grammatical forms.
- Residence must never be presented as current live location.
- If asked “איפה מור?”, the safe grounded answer is: “מור גרה בהוד השרון עם יעל, אבל אני לא יודעת איפה היא נמצאת כרגע.”

There may be additional canonical data in `knowledge/family_data.json`, YAML files, generated memory files, and family services. Always inspect canonical data rather than guessing.

---

# 5. Permanent Claude Code operating rules

- Work in one foreground execution context by default.
- No background agents, forks, worktrees, or parallel code-editing streams unless explicitly authorized.
- Read-only agents may be used only when they materially reduce uncertainty.
- Routine safe commands and edits are pre-approved.
- Minimize permission prompts.
- Never perform destructive actions without explicit approval.
- Never merge to `main`.
- Never deploy Production without explicit approval.
- Preview deployments are allowed when release gates are green.
- Never use `git add -A`.
- Stage only explicit files.
- Never force-push.
- Never expose `.env`, API keys, private phone data, family private files, or secrets.
- Tests and build must run sequentially, never simultaneously.
- Use stable single-worker test mode when the machine suffers OOM.
- Do not confuse environment crashes with code failures.
- Always disclose unproven physical-device items.
- Every final response must include one exact next action.

---

# 6. Evidence hierarchy

Use this strict ladder:

1. `PRODUCTION`
2. `PHYSICAL_DEVICE`
3. `PREVIEW`
4. `BROWSER`
5. `INTEGRATION`
6. `MOCK`
7. `CODE`
8. `REPORT`
9. `ASSUMPTION`

Rules:

- A lower evidence class cannot override a higher one.
- Real iPhone evidence overrides tests.
- Browser playback does not prove audible iPhone speaker output.
- Mock provider tests do not prove live online retrieval.
- Code support does not prove runtime wiring.
- Local green does not make a full capability green.
- A capability may only be green at the evidence class required for the user experience.

---

# 7. Fundamental engineering principles learned

## Diagnose the first divergence

Every failure must be traced through the actual runtime pipeline:

```text
Input
→ Microphone/audio capture
→ VAD/end-of-speech
→ STT
→ Language policy
→ Correction handling
→ Intent classification
→ Follow-up/context
→ Working memory
→ Family/calendar/online tool
→ Reasoning
→ Response composition
→ TTS
→ Audio decode
→ Playback
→ Conversation continuity
```

Fix the earliest wrong stage, not a downstream symptom.

## Never patch an example

- If “בוקר טוב” is misheard, do not special-case the phrase.
- If “אמרתי זה הסרט” is ignored, build generalized correction handling.
- If “מי משחק היום?” fails, fix current-information routing and provider grounding, not the World Cup phrase.
- If “איפה מור?” hallucinates location, separate residence, usual location, scheduled location, and verified live location.

## Prefer existing mechanisms

The repository is over-built, not under-built.

Before creating a new mechanism, search for existing resolvers, dead but correct logic, duplicate runtimes, unwired services, tests, and experimental paths.

Prefer wiring and consolidation over adding more parallel systems.

## Real user evidence is product truth

The project repeatedly had thousands of passing tests and “Production ready” reports while the iPhone experience still failed. All claims must state their evidence class explicitly.

---

# 8. Architecture truth

## Single authoritative runtime

The live path was investigated and found to funnel typed, pipeline-microphone, and realtime-voice inputs through:

`ExecutiveCognitiveController.handleTurn()`

The repository also contains historical or parallel components, including:

- `conversationEngineV2`
- `conversationOS`
- `cognitiveRuntime`
- `conversationBrain`
- `understandingOrchestrator`
- `executiveCognitiveController`
- legacy `tryGroundedAnswer` paths
- family and online resolvers

Some correct logic exists in dead legacy paths. This has already caused real bugs.

Do not assume a tested function is live. Confirm who imports it, which branch executes, whether a feature flag bypasses it, whether `index.tsx` reaches it, and whether the real controller calls it.

## Typed and voice parity

Typed input and pipeline-microphone text were unified through the same controller.

Native Realtime/WebRTC has separate audio transport concerns, but the cognitive brain should remain unified.

Never allow typed and voice to use different reasoning, calendar, memory, family, or online logic.

---

# 9. Engineering OS already built

Foundation Release 1 established an Engineering OS.

Important files include:

- `docs/engineering-os/PHASE_0_DISCOVERY_AND_BOOTSTRAP_PLAN.md`
- `docs/engineering-os/FOUNDATION_RELEASE_1_REPORT.md`
- `docs/engineering-os/PRODUCTION_ACCEPTANCE_BOARD.md`
- `.claude/settings.json`
- `.claude/rules/`
- `.claude/skills/`
- `.claude/hooks/`
- `src/engineering-os/evidence.ts`

Eight primary skills were created:

- `system-discovery`
- `grill-me`
- `production-reality`
- `gold-replay`
- `failure-to-regression`
- `release-gate`
- `preview-verification`
- `incident-report`

Nine scoped rules exist:

- voice
- online
- calendar
- memory
- family
- privacy
- testing
- deployment
- evolution

Hooks were activated for session start, dangerous command blocking, lightweight post-edit checks, and stop/claim checking.

Safety guards were proven to block:

- `git add -A`
- `git push --force`
- `vercel --prod`
- reading `.env`
- staging `*.private.json`

Emergency bypass: `ABU_HOOKS_DISABLE=1`. Use only if absolutely necessary and disclose it.

The official TypeScript plugin was enabled in settings, but runtime LSP tools were not exposed to the session, so operability remained unverified. It is useful but not required.

---

# 10. Important commits and versions

Primary branch: `rc5/cognitive-architecture-and-acceptance`

Known important commits/versions:

- `d78e448` — Executive Cognitive Controller, around `0.18.0-executive-cognitive-controller`
- `046f487364e32aeed1bb47e9a545a7d6d5ed2a25` — Evolution OS observe-only slice, `0.58.0-evolution-os-observe-slice`
- `a4eb432` — multilingual voice language policy, `0.59.0-multilingual-voice-language-policy`
- `db66debd271e04bc8640d07fa3d6cc19c678cce2` — iPhone voice runtime repair, `0.59.1-iphone-voice-runtime-repair`
- `acdc5c43770fe3c151cfcc82fcfa839304b43bc9` — family-phone import, `0.60.0-private-family-phones-import`
- `1398883` — family phone ID alias correction (`rafi` → `raphi`), `0.60.1-family-phones-id-alias`
- `7df58bd` — bilingual STT language handling, `0.61.0-stt-hebrew-language`
- versions around `0.62.0` — OpenAI → Gemini → Web Speech fallback, truthful `played`, tap-to-hear, playback counter
- `090b54b` — Realtime audio timeout watchdog, `0.63.0-realtime-audio-timeout`
- `f2b64f556da9ed92accf86ef7f775eedb690b4bc` — durable flush on app hide, `0.64.0-durable-flush-on-hide`
- `cca1972c4e6cafe738a894e55716fb06dcf8b7e3` — current-info grounding, `0.65.0-current-info-grounding`
- `d9cbfa1a15340dfe84814ced0bf8565009000c53` — fragmented create continuity, `0.66.0-fragmented-create-continuity`
- `87401f66b219b224aed4f7bb4c1bef4a8ce3f653` — natural slot-fill clarification, `0.67.0-natural-slotfill-clarify`

Before doing anything, run:

```bash
git status --short
git branch --show-current
git log --oneline -20
```

Do not assume this document’s latest commit is still HEAD.

---

# 11. Real physical-device failures

## Voice and STT

Observed on iPhone:

- Microphone opened.
- Hebrew speech was sometimes recognized as Cyrillic.
- “בוקר טוב” became something like `.Бокалтово`.
- “זה הסרט” became “זה פט”.
- “איזה משחק יש מחר?” became “איזה עסק יש לך?”
- Other phrases were malformed.
- Text answers appeared, but no sound played.
- Repeated UI message: “משהו לא עבד. ננסה שוב?”
- Response times were approximately 20 seconds.
- Conversation felt robotic and fragmented.

## TTS

At multiple points, the assistant returned text but no audible output was heard.

Playback fallback and watchdog were implemented later. Browser-level playback was proven. Physical iPhone audibility remains required.

## Online/current information

Observed failures included:

- “מי משחק הלילה במונדיאל ומה ההרכבים?”
- “המונדיאל עכשיו”
- “עכשיו יש מונדיאל ונמצאים בשלבי רבע הגמר”
- “ספרי לי על המונדיאל היום”
- “איזה משחק יש מחר?”
- “אין לך online?”

The system incorrectly claimed the last World Cup was in 2022 and gave stale or false information instead of invoking a live provider.

Hard rule:

> No verified live tool result = no current fact claim.

If provider retrieval fails, say so honestly.

## Calendar

Real sequence:

- User created a meeting with Moti.
- Assistant confirmed it was saved.
- It could read it back once.
- Later it said it had no information about the meeting.
- Modification attempts failed.
- Follow-up “כן” lost context.
- No reliable create → confirm → commit → read → modify → read-back → delete flow was proven on device.

## Family grounding

“איפה מור?” was answered as if Mor was currently at home. Residence was converted into current location.

## Natural conversation

Observed behavior felt robotic, repetitive, fragmented, and like an old voice system. There were generic clarifications, “say it again” loops, poor continuity across fragments, corrections acknowledged but not applied, and follow-ups losing the thread.

---

# 12. Major fixes already completed

## Voice event compatibility

Realtime event handling was updated for current and legacy event names. A Voice Flight Recorder was added.

## Realtime model centralization

Hard-coded model drift was replaced with one model source. Model used was `gpt-realtime`. Verify the current official API contract before changing it.

## Language handling

Unrestricted auto-detection caused Hebrew to become Cyrillic. The policy changed toward Hebrew default, Spanish for an active Spanish conversation, and consistent browser/Realtime hints. Do not permanently force Hebrew.

## TTS fallback

The pipeline was changed toward OpenAI → Gemini → Web Speech → truthful failure. `played: boolean`, a playback counter, and visible recovery were introduced.

## Realtime audio watchdog

If Realtime accepts a response but emits no audio within about five seconds, classify `REALTIME_AUDIO_TIMEOUT`, cancel the stalled response, fall back to pipeline TTS, prevent silent waiting, and record evidence.

## Online routing

A current-information detector was added to prevent volatile world facts from leaking to offline model memory. This was CODE/TEST proven; live provider PREVIEW proof still matters.

## Durable persistence

In-flight IndexedDB writes are tracked and flushed on `pagehide` and `visibilitychange` hidden. This addressed a cross-reload iOS data-loss gap. Do not confuse it with all calendar failures.

## Fragmented calendar create

A natural user may create a meeting across several turns: “תקבעי” → “עם מור” → “מחר בשלוש” → “כן”. Previously the bare opener did not persist a draft. A pending draft is now opened for genuine bare create openers.

## Natural slot-fill clarification

Robotic/context-free questions such as “באיזה יום?” were changed toward person-aware prompts like “לאיזה יום ושעה לקבוע עם מור?”.

## Family-phone import

A dedicated family-phone JSON import page exists at `/settings/family-phones`. Alias mapping includes input `rafi` → canonical `raphi`. Private phone data must never be committed.

---

# 13. Important unfinished problems

## Relational family questions — highest known uncovered bug

A recent investigation found that queries such as:

- “quién es la hija de Mor”
- “la nieta de Martita”
- “who is Mor’s daughter”
- “מי הבת של מור”

were routed to general LLM instead of the family graph.

A correct `resolveRelationalQuery` function exists and has unit tests, but it was wired only into a dead legacy path. The live path classified these queries as general.

Before fixing, verify against current HEAD.

The intended fix should:

- Detect relational family queries in Hebrew, Spanish, and English
- Route through one grounded family path
- Reuse existing graph logic
- Never invent unknown relations
- Preserve gender correctness
- Include negative controls
- Add a gold replay using the real controller

Do not trust example expected relatives blindly. Verify every expected relation from canonical family data before assertions.

## Online real provider proof

Routing improved, but live Preview provider proof is required: provider invocation, route reachability, credentials, parsing, sources, date awareness, no stale fallback, honest failure.

## Voice physical proof

Still required: iPhone mic, Hebrew STT, Spanish STT, Realtime connection, audible TTS, audible fallback, natural warmth, interruption, latency, and no silent error.

## Calendar transactional integrity

Must pass:

```text
CREATE
→ CONFIRM
→ COMMIT
→ READ
→ MODIFY
→ READ-BACK
→ DELETE
→ VERIFY DELETED
```

Known `it.todo()` items have included post-save edit cases. Do not implement risky event mutation without understanding data-loss and exactly-once semantics.

## Correction loop

Must support generalized Hebrew and Spanish correction patterns. A correction must target the right prior utterance, preserve original evidence, update the working transcript, re-run the intended turn, and not stop at an apology.

## Follow-up continuity

Must retain prior intent, entity, timeframe, required tool, pending calendar action, previous provider failure, correction target, and pronouns/references.

## Latency

Observed approximately 20 seconds. Measure end-of-speech→transcript, transcript→intent, tool duration, LLM duration, response composition, TTS request, playback start, and total turn.

Initial targets:

- local deterministic answer p95 < 1 second
- calendar/family p95 < 2 seconds
- online p95 < 5 seconds
- voice response p95 < 3 seconds after speech end

Do not merely shorten timeouts.

---

# 14. Evaluation infrastructure and lessons

The repository has had around 300 test files, over 10,700 passing tests, acceptance harnesses, stress/fuzz, destruction lab, red-team suites, benchmarks, Evolution OS, and many reports.

This is useful but insufficient.

The project repeatedly generated false-green system conclusions. The Acceptance Board must remain intentionally pessimistic.

Every real user failure should become:

- deterministic replay
- generalized regression family
- acceptance scenario
- evidence record

Do not create phrase-specific patches.

Stress/fuzz has caught self-inflicted regressions. Always run high-risk stress suites before full suite for central runtime changes.

---

# 15. Evolution OS status

An observe-only Evolution OS was created with trace envelopes, evidence queue, signals, failure taxonomy, state machine, generalization, improvement bundles, evaluation/release structures, and IndexedDB evidence persistence.

Important limitation: it is not a self-healing system.

It does not yet provide real server ingestion, automatic code fixes, live shadow candidates, autonomous promotion, or full closed-loop learning.

Never describe it as autonomous self-repair. Use it as evidence infrastructure only.

---

# 16. Permanent recovery workflow

Every recovery cycle should follow:

```text
REALITY REFRESH
→ CHALLENGE ASSUMPTIONS
→ RANK PROBLEMS
→ SELECT ONE ROOT PROBLEM
→ WRITE FAILING REGRESSION
→ CONFIRM EXPECTED FAILURE
→ APPLY MINIMAL ROOT FIX
→ ATTACK THE FIX
→ CROSS-JOURNEY VALIDATION
→ TARGETED TESTS
→ GOLD REPLAY
→ STRESS/FUZZ
→ BENCHMARK
→ TYPECHECK
→ FULL SUITE
→ BUILD
→ PRIVACY SCAN
→ PREVIEW
→ ACCEPTANCE BOARD
→ COMMIT/PUSH
→ RE-RANK
```

Stop only when:

- all automatable red/orange items are closed, or
- the next proof genuinely requires physical iPhone, or
- a destructive/security/data decision requires approval, or
- an external credential/provider blocker prevents progress

Do not stop after one easy fix if other automatable blockers remain.

---

# 17. Required recovery state file

Maintain:

`docs/production-recovery/AUTONOMOUS_RECOVERY_STATE.md`

It should contain current branch, commit, version, Preview URL, capability table, evidence classes, completed cycles, blockers, first divergences, highest-ROI next issue, device-only items, and exact next action.

Do not create multiple competing recovery-state documents.

---

# 18. Preview and deployment discipline

Preview verification should attempt:

1. Check Vercel CLI auth
2. Check branch auto-deploy
3. Find latest deployment
4. Verify branch and commit
5. Verify root 200
6. Verify `/api/health`
7. Verify build version
8. Verify API routes
9. Verify service-worker freshness
10. Verify console/page errors
11. Run exact failed scenario
12. Verify real online provider when relevant

Do not say “no credentials” before checking.

Never deploy Production without Leo’s explicit approval.

---

# 19. Test execution discipline

Known machine issue: parallel full-suite runs may cause OOM or teardown crashes. Stable single-worker execution has passed.

Rules:

- Run targeted tests first.
- Run full suite once per complete recovery cycle.
- Preserve raw logs for important failures.
- Distinguish assertion failure, OOM, teardown, tooling, and external provider error.
- Do not repeatedly rerun expensive suites without reason.
- Build only after tests finish.

---

# 20. Working-tree caution

At several points there were many unrelated modified/untracked files: UI/CSS, generated family YAML, evaluation reports, screenshots, logs, deleted tests, and local Claude settings.

Before every commit:

- inspect `git status`
- identify pre-existing unrelated changes
- stage only explicit files
- never overwrite generated family data casually
- never include private JSON
- never include logs or screenshots unless intended

---

# 21. Historical mistakes not to repeat

1. Declaring “fixed” without iPhone proof.
2. Treating browser audio as physical speaker proof.
3. Using mock provider tests as online proof.
4. Creating new runtimes when correct logic already exists elsewhere.
5. Fixing example phrases instead of mechanisms.
6. Running dozens of agents for a small task.
7. Letting multiple agents edit the same files.
8. Spending cycles on low-impact infrastructure while P0s are red.
9. Choosing only tasks easy to prove without device.
10. Asking Leo to test after every tiny cycle.
11. Creating optimistic reports that contradict device evidence.
12. Losing the next action at the end of a response.
13. Re-running full discovery after every cycle.
14. Treating reports as stronger than code.
15. Treating code as stronger than runtime.
16. Conflating residence with live location.
17. Answering current facts from stale model memory.
18. Saying a calendar event was saved without verifying storage.
19. Acknowledging a correction without reprocessing it.
20. Returning generic clarification after user frustration.

---

# 22. Communication protocol with Leo

Every response must include:

## What is happening now

One sentence.

## What was proven

Only facts.

## What remains unproven

Explicitly.

## What Leo must do now

Exactly one action.

Do not end with vague language or multiple options.

---

# 23. Immediate startup sequence for Claude

Before editing anything:

1. Read this handoff completely.
2. Read:
   - `docs/engineering-os/PRODUCTION_ACCEPTANCE_BOARD.md`
   - `docs/engineering-os/FOUNDATION_RELEASE_1_REPORT.md`
   - `docs/engineering-os/PHASE_0_DISCOVERY_AND_BOOTSTRAP_PLAN.md`
   - latest recovery report
   - latest real iPhone transcript evidence
   - `docs/production-recovery/AUTONOMOUS_RECOVERY_STATE.md` if present
3. Run:
   - `git status --short`
   - `git branch --show-current`
   - `git log --oneline -20`
4. Verify current version.
5. Verify whether the relational-family bug still exists in current HEAD.
6. Re-rank all automatable production blockers.
7. Select the highest Production Delta issue.
8. Continue autonomously until a formal stop condition is reached.

---

# 24. Master startup prompt for Claude

Paste this after providing the handoff document:

```text
You are taking over complete product and engineering leadership of AbuBank/AbuAI.

Read the attached COMPLETE PROJECT HANDOFF in full before doing anything.

Treat it as project context, not as unquestionable truth. Verify every current-state claim against the repository, current branch, git history, runtime wiring, tests, Preview, and device evidence.

Your mission is to make AbuAI as close as realistically possible to modern ChatGPT Voice for Martita and reach genuine production readiness.

Permanent rules:

- Real physical-device evidence overrides tests and reports.
- Fix first divergence, not symptoms.
- Never patch an example.
- Reuse existing mechanisms before creating new ones.
- One foreground code-editing stream.
- No merge to main.
- No Production deploy.
- Preview allowed after gates.
- Never git add -A.
- Protect secrets and private family data.
- Tests and build sequentially.
- Every final response must include exactly one operational next action.

Start with a reality refresh:

1. Read the handoff completely.
2. Read the current Production Acceptance Board and latest recovery state.
3. Inspect git status, branch, log, version, and working-tree drift.
4. Confirm which prior fixes are actually in current HEAD.
5. Reproduce the highest-value uncovered issue against the live runtime.
6. Rank all remaining automatable blockers by Production Delta.
7. Select one root problem.
8. Write a failing generalized regression first.
9. Apply the smallest safe root fix.
10. Attack it with negative controls, multilingual, follow-up, and cross-journey tests.
11. Run targeted, integration, GOLD replay, stress/fuzz, benchmark, typecheck, full suite single-worker, build, privacy scan, and Preview verification sequentially.
12. Update the Recovery State and Acceptance Board.
13. Commit and push only explicit scoped files to rc5/cognitive-architecture-and-acceptance.
14. Continue recovery cycles automatically until:
   - all automatable RED/ORANGE items are closed, or
   - the next proof genuinely requires Leo’s iPhone, or
   - a destructive/security/data decision requires approval, or
   - an external credential/provider blocker prevents progress.

The most recent known high-value uncovered issue was relational family queries being routed to the LLM rather than the grounded family graph. Do not assume it still exists. Reproduce it first using the real controller and canonical family data. Verify expected relations from the data before writing assertions.

When stopping, return:

1. Stop condition
2. Current Product Status Table
3. Cycles completed
4. What became green
5. Remaining red/orange/yellow/unknown
6. Benchmark and GOLD replay results
7. Cross-journey results
8. Preview/provider verification
9. Latency results
10. Commit SHA(s)
11. Branch/version/Preview URL
12. Production readiness with formula
13. Exact physical test if required
14. Exactly one next action for Leo
15. Exactly one complete next prompt

Begin now.
```

---

# 25. Final principle

The project must never again confuse:

- a report with proof
- a test with runtime
- a browser with an iPhone
- storage success text with committed data
- a residence fact with live location
- a model answer with current online truth
- an apology with correction
- code completeness with product readiness

The final proof is that Martita can use AbuAI naturally, reliably, and confidently on her real device.
