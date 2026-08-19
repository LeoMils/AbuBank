---
name: production-war-room
description: ROI-driven loop — NORTH_STAR → run BENCHMARK_CONVERSATIONS → pick highest user-ROI change → implement only it → re-benchmark → update IMPACT_SCOREBOARD → recommend next. Use to move AbuAI toward production.
---

# Production War Room (ROI-driven)

Every cycle follows this EXACT order. Do not skip steps; do not implement before
benchmarking.

## Cycle
1. **NORTH_STAR** — read `.claude/project_state/NORTH_STAR.md`. The goal is the
   user feeling, measured by BENCHMARK_SCORE.
2. **BENCHMARK** — run:
   `npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts`
   Record `[BENCHMARK_SCORE]`, per-category, and `[FAILURES]`.
3. **PICK (highest user-ROI)** — choose the SINGLE change that, for the least risk:
   - fixes the most user-impactful FAILING benchmark moment, OR
   - removes a P0 (`P0_BLOCKERS.md`), OR
   - unblocks Production.
   If the score is at 100%, ADD a new scenario to `SCENARIOS` that represents a
   real gap (it will fail → it names the next highest-ROI work), then fix it.
   Elegance / refactors / test-count are NOT ROI — reject them.
4. **IMPLEMENT only that change** (smallest safe). Increment `src/version.ts`.
5. **RE-BENCHMARK + gates** — re-run the benchmark AND `npm run check`
   (typecheck + full test) AND `npm run build`.
6. **IMPACT_SCOREBOARD** — add a row to `.claude/project_state/IMPACT_SCOREBOARD.md`
   (version, score before→after, Δ, change, evidence). If the score rose, raise the
   `FLOOR` in `benchmarkConversations.test.ts`.
7. **RECOMMEND NEXT** — only now, name the next highest-ROI task (with its expected
   benchmark moment).

## Hard rules
- No change ships without a benchmark run before AND after.
- Do NOT add agents/skills unless you can prove they raise BENCHMARK_SCORE or
  unblock Production. The benchmark is code, not an agent.
- Mandatory STOP conditions (see `.claude/CLAUDE.md`) still apply.
- Most Hebrew UI is by design — localize only moments the user must ACT on.
