# WAR_ROOM_LOG

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
