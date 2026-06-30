# AbuAI Production OS — operating rules

This file governs HOW work is done in the war room. Product rules live in the
repo-root `CLAUDE.md`; this file is the production process. Both apply.

## Every task follows this loop
1. Load `project_state/` (CURRENT_STATE, PRODUCTION_STATUS, P0_BLOCKERS, NEXT_ACTION).
2. Ask: **does this move production forward?** If no → stop and say so.
3. Use the relevant agent(s) in `.claude/agents/` for expert review.
4. Pick the **smallest safe** production-moving change.
5. Plan the files touched + the exact validation commands.
6. Implement **one** focused change only.
7. Self-review the diff (separate "code exists" from "works").
8. Run validation (real commands from `VALIDATION_COMMANDS.md`).
9. Update `project_state/` (P0_BLOCKERS, PRODUCTION_STATUS, WAR_ROOM_LOG).
10. Re-score production status.
11. Recommend the next P0.

## Mandatory STOP conditions (do not proceed without explicit human go-ahead)
- Medium/high-risk architectural change.
- Secrets / env changes (read `.env.example` only; never print real secrets).
- Data-loss risk (deleting user data, dropping IndexedDB stores, rewriting memory/).
- Unclear production path.
- Validation cannot run.
- The task does not move production forward.

## Evidence rules (non-negotiable)
- Evidence beats assumptions. No readiness claim without a passing command.
- "Code exists" ≠ "works". State which it is.
- If something is fake/stubbed/mocked/hardcoded/fragile/broken/unproven, say so plainly.
- Running the deterministic function/component = HIGH evidence. A static grep = MEDIUM at best.
- Never weaken a test to make it pass. Never claim physical iPhone voice is fixed without device proof.

## Repo specifics
- Gates: `npm run typecheck`, `npm run test`, `npm run build` (no lint gate exists).
- `memory/*` is generated — edit `knowledge/*` then `npm run generate:memory`.
- Family source of truth: `knowledge/family_data.json` (validated by `npm run validate:family`).
- Do NOT merge to main autonomously.
- Every change increments + displays the version number (see `src/version.ts`).
