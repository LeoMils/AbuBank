# WAR_ROOM_LOG

## 2026-07-14 — parity program · recovery cycle 0.71.0 (family ex-spouse directionality)
- SELECTED DIVERGENCE (user-directed): option 2 from the 0.69.0/0.70.0 release notes — family ex-spouse
  directionality, a release-gate for family correctness. Martita must get the right answer in BOTH directions.
- GROUND TRUTH (knowledge/family_data.json, verified before writing assertions): Mor (מור, female) ex_spouse=רפי,
  partner=יעל; Raphi (רפי, male) = ex_son_in_law "הגרוש של מור". Ex-spouse is a SYMMETRIC graph edge (exSpousesHe).
- REPRODUCED at runtime (RED-first, via tryGroundedAnswer + answerFamilyRelation): `מי הגרוש של מור` routed to
  family_lookup → returned Mor's profile blurb ("מור, הבת שלך…"), NOT the ex-spouse; `answerFamilyRelation`
  returned null (REL table had grandmother/grandfather/aunt/uncle/children/partner but NO ex-spouse rule) → LLM
  fallback. Reverse `רפי הוא הגרוש של מי` only "passed" by coincidence (Rafi's profile text mentions מור).
- FIRST DIVERGENCE: missing `ex_spouse` rule in `familyReasoning.ts` REL. `tryGroundedAnswer` consults
  `answerFamilyRelation` BEFORE the profile-lookup route, so one rule set fixes forward correctly AND upgrades the
  reverse from coincidental-blurb to deterministic relational answer.
- FIX (smallest): added `exSpouseOf()` (symmetric `exSpousesHe`) + 3 REL regexes each capturing the real person
  name (forward `מי הגרוש/הגרושה של X`, from-whom `ממי X גרושה`/`X גרושה ממי`, reverse `X (הוא/היא) הגרוש של מי`;
  forward excludes the interrogative מי via lookahead). Added `ex_spouse: 'הגרוש/ה'` render label in service.ts
  (gender-neutral like partner's `בן/בת הזוג` — correct in both directions since the edge is symmetric).
- REGRESSION FIRST → then fix: src/screens/AbuAI/exSpouseDirectionality.test.ts (forward/from-whom/reverse/reverse-
  no-copula, resolver known+relation=ex_spouse, never-invent-for-Leo, and partner non-regression מור→יעל).
- ALSO fixed pre-existing drift surfaced by the full suite: copyTurnsButton.test.tsx hardcoded the version at
  0.67.0 (stale since 0.68.0; prior cycles only ran the AbuAI subset). Rewrote it to track the single source
  (shape match) instead of a frozen literal — the canonical contract stays in version.test.ts. NOT a weakening.
- VALIDATION: exSpouseDirectionality 7/7; genderMatrix/rc3/familyReasonerProperties/ofirGenderRegression 56 (Ofir
  feminine forms intact); benchmark floor 100%; FULL suite 10788 pass/2 todo/0 fail (303 files); tsc clean; build
  clean. Version 0.70.0→0.71.0 (version.ts + health.ts + version.test.ts in sync).
- EVIDENCE: CODE / AUTOMATED_TEST (deterministic function run = HIGH; LLM/online not involved — this path is
  pure-local by design). NOT device-proven. Residual es divergences from 0.70.0 still open (ambiguous es hour
  "a las diez"; Spanish "no"=cancel; mid-create meta replies Hebrew). Next candidate: es ambiguous-hour resolution.

## 2026-07-14 — parity program · recovery cycle 0.70.0 (Spanish create stays Spanish, §20.2)
- SINGLE-WRITER: re-acquired lock (HEAD==origin 338b8a0, 0/0, prior lock released). v2.1.190 foreground-only;
  deny rules persisted. Pushed clean at end.
- SELECTED DIVERGENCE (user-directed): after 0.69.0 the mandatory es create SAVES but every AbuAI turn was
  Hebrew — clarify "באיזו שעה?", confirm "…נכון?", save "קבוע —". §20.2 requires "remain in Spanish".
- REPRODUCED at runtime: confirmed all three flows Hebrew. Key insight: detectLang("a las cuatro")='he',
  so per-turn detection flips locale mid-create → the create's language must be REMEMBERED on the draft.
  Also found the draft TITLE is Hebrew ("פגישה עם Gabi") even for es, and composeHebrew/toSpokenText would
  mangle Spanish text.
- FIX: added CreateDraft.lang (persisted across turns); helpers createLangOf/shapeCreatePrompt/composeCreate
  (es bypasses Hebrew persona shaping)/withLang; localized executeSave (es save + conflict warn); rendered
  "פגישה עם X"→"una reunión con X" in shapeCreateConfirmES/shapeCreateSavedES (titleES); added optional lang
  to `settle`. Threaded through the v2 branch (execute_save/cancel/replace/update) AND the intent-path
  calendar_create + confirmation cases (save/cancel/replace/update). ES shapers already existed (reused).
- REGRESSION FIRST → then fix: src/eval/spanishCreateLocale.test.ts (confirm/clarify/save all Spanish, no
  Hebrew chars; cross-turn continuity via "a las cuatro"; Hebrew create unaffected).
- VALIDATION: spanishCreateLocale 5/5; benchmark floor 100%; AbuAI+AbuCalendar+eval 9923 pass/2 todo (zero
  regressions); version 22; tsc clean; vite build clean. Version 0.69.0→0.70.0.
- EVIDENCE: CODE / AUTOMATED_TEST (LLM/online stubbed). NOT device-proven. Residual es divergences documented
  on the Board: (1) bare ambiguous es hour 7–11 ("a las diez") not resolved single-utterance (es analog of
  0.68.0) → "dale" dead-ends; (2) Spanish "no" not recognized as cancel; (3) mid-create meta replies still
  Hebrew. Next cycle candidate: es ambiguous-hour resolution OR family ex-spouse directionality (still open).

## 2026-07-14 — parity program · recovery cycle 0.69.0 (Spanish transcript locale integrity)
- SINGLE-WRITER: re-acquired lock (HEAD==origin 2d32f08, 0/0, prior lock released). v2.1.190 foreground-only;
  deny rules (Agent/Task/worktree) persisted. Pushed clean at end.
- SELECTED DIVERGENCE: probed the 3 §40 hypotheses via the real runtime. Findings — (c) filler-led create
  already WORKS; (a) family ex-spouse directionality is RED (מי הגרוש של מור / ממי מור גרושה / רפי הוא הגרוש
  של מי all punt to LLM while מי בת הזוג של מור→יעל works) — deferred to next cycle; (b) locale contamination
  is RED and the HIGHEST severity: the MANDATORY §20.2 sentence "agendá una reunión con Gabi mañana a las
  tres" fails end-to-end (asks "באיזו שעה?" in Hebrew, "dale" dead-ends, nothing created).
- FIRST DIVERGENCE (isolated it precisely): startCreate() works on the raw sentence (confirming, 15:00), but
  the runtime feeds it recoverTranscript()'s output which corrupts "mañana a las tres" → "mañana las tres".
  Root cause: the dedup LEXICON rule used a HEBREW-ONLY boundary (?<![א-ת]), so on Latin text it captured the
  trailing "a" of "mañana" + the standalone preposition "a" as a false "a a" duplicate.
- FIX (smallest): dedup boundary → script-agnostic \p{L}\p{M}. Whole-word dedup in any script; Spanish safe.
- REGRESSION FIRST → then fix: src/eval/spanishCalendarGoldReplay.test.ts (recoverTranscript locale-integrity
  unit incl. Hebrew+Latin dedup still works, + §20.2 end-to-end create-once-at-15:00 + "dale" saves).
- VALIDATION: gold replay 5/5; AbuAI+AbuCalendar+eval 9918 pass/2 todo (zero regressions); version 22; tsc
  clean; vite build clean. Version 0.68.0→0.69.0 (version.ts+health.ts+version.test.ts).
- EVIDENCE CLASS: CODE / AUTOMATED_TEST (LLM/online stubbed). NOT device-proven. Remaining locale gap
  (separate divergence, documented): Spanish create clarify/confirm text still Hebrew. Next cycle candidate:
  family ex-spouse directionality (a) OR Spanish confirm/clarify localization.

## 2026-07-13 — ChatGPT-Live parity program · recovery cycle 0.68.0 (fragment ambiguous-hour parity)
- SINGLE-WRITER: acquired `.abuai/ACTIVE_EXECUTION_LOCK.json` (gitignored); Claude Code 2.1.190
  (subagents run in background by default → NO subagent dispatch used, foreground-only). Added deny
  rules (Agent/Task/git worktree) to `.claude/settings.local.json`. Branch rc5 sole-writer verified
  (2 setup commits ahead of origin, 0 behind).
- RECONCILE: verified NEXT_ACTION (2026-06-30) claim "Spanish create isCreateIntent=false" is STALE —
  Spanish create is now implemented (CREATE_INTENT_ES). Benchmark saturated at 100% floor.
- SELECTED DIVERGENCE (board-named, machine-provable, no device): fragment "drip" create with an
  AM/PM-ambiguous bare hour stayed ambiguous so a bare "כן" never completed (dead-ended in loop-breaker),
  while the single-utterance path resolved via the smart layer → a typed/voice PARITY defect.
- FIRST DIVERGENCE: `understandMeetingSmart` resolves the ambiguous hour only for a single utterance
  (needs who+date+time together); the fragment slot-fill (`updateCreate`) kept `ambiguousTime` and
  reported time missing forever.
- FIX (smallest): `updateCreate` fresh-ambiguous-hour branch resolves to the same default reading + moves
  to confirming; confirm branch absorbs a bare period correction ("לא בערב") to flip AM→PM.
- REGRESSION FIRST → then fix: `src/eval/fragmentedCreateGoldReplay.test.ts` 4→6 cases (2 parity + 1
  correction assertion; corrected the old test that encoded the bug).
- VALIDATION: gold replay 6/6; AbuAI 4302 pass/2 todo; AbuCalendar+eval 5611 pass; version 22 pass;
  tsc clean; vite build clean. Version 0.67.0→0.68.0 (src/version.ts + api/health.ts + version.test.ts).
- EVIDENCE CLASS: CODE / AUTOMATED_TEST (LLM/online stubbed). NOT device-proven. Board Natural
  Conversation row stays 🔴 pending device felt-quality.

## 2026-06-30 — Production War Room OS established
- Created .claude Production OS (CLAUDE.md, project_state, agents, skills, hooks).
- Triage with evidence (see CURRENT_STATE / PRODUCTION_STATUS).
- Findings: build/test green; deploy healthy; no exposed secrets; realtime provider
  down (fallback validated); physical voice device-gated. NO open code P0.

## 2026-06-30 — Mission Commander loop (find → implement → measure → repeat)
### Iteration 1 — localized + offline-aware chat-failure copy (commit 1d36335, v0.8.2)
- FOUND (production-commander, evidence): terminal "all providers failed" path
  yielded ONE hardcoded Hebrew line (service.ts:1473/1571) regardless of language
  or offline state — a dead-end for a Spanish/offline user; localized copy infra
  already existed (serverChatProvider).
- IMPLEMENTED: chatTerminalFallback(messages,{offline}) — detectLanguage + navigator.onLine
  → he/es/en + "no internet" vs "provider down". Hebrew default kept (back-compat).
- MEASURED: chatFailureCopy.test.ts (8 HIGH-evidence assertions) green; static-grep
  tests (236) unchanged; suite 5971→5979.

### Iteration 2 — lazy-load reminderStore off AbuAI first-open (commit 94c64c1, v0.8.3)
- FOUND (commander runner-up): reminderStore (delivery+durable) statically imported
  into AbuAI, only used in 2 reminder-confirm branches.
- IMPLEMENTED: await import() in those 2 async branches; removed static import.
- MEASURED (build chunk table): reminderStore 164 kB / 61 kB-gzip eager → 13 kB /
  5.4 kB-gzip on-demand. tsc clean, build exit 0, suite 5979 green.

## Next iteration candidates (not yet done)
- Localize the NON-error user-facing strings only where the user must ACT (most
  Hebrew UI is by design — do NOT mass-localize).
- Real runtime assertions to replace remaining static-grep "tests" (evidence upgrade).
- Re-run production-commander for the next biggest improvement with fresh evidence.
