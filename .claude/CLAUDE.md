# AbuAI Production OS — operating rules

This file governs HOW work is done in the war room. Product rules live in the
repo-root `CLAUDE.md`; this file is the production process. Both apply.

## TOP-LINE METRIC — the Golden Session (read `.claude/rules/golden-session.md`)
The number that matters is: **does a full session complete with every turn correct and no dead ends?**
NOT coverage %, NOT a green gate count. Before claiming any session/voice work done, run the Golden
Session (`node scripts/golden/golden-session.mjs`, real model) and report PASS/FAIL + which turns
deviated. The handover report MUST state: golden pass/fail + deviating turns; how many full sessions
run and transcripts read; every anomaly; what was fixed and re-verified end to end. "Gates green" is
NOT an acceptable report — green unit tests are CODE evidence only and never prove a session works.

## Knowledge System — LOAD FIRST (before any task)
0. Read `knowledge/KNOWLEDGE.md` (single-source manifest) + the relevant authority
   file (family_data.json / product / behavior / production_rules / abuai_identity).
   Never duplicate a fact; point to its authority. Family edits → skill
   `add-family-member`; knowledge edits → skill `update-knowledge`. Validate via
   `npm run validate:knowledge` (auto in prebuild). Never hand-edit `memory/*` or
   `knowledge/family/people/*` (generated).

## Every task follows this ROI loop (in order)
1. **NORTH_STAR** — read `project_state/NORTH_STAR.md`. The goal is the user
   feeling, measured by BENCHMARK_SCORE.
2. **BENCHMARK** — run `npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts`;
   record the score + failing moments. Also load CURRENT_STATE / P0_BLOCKERS.
3. **PICK** the single highest user-ROI change (fix the most impactful failing
   benchmark moment, or remove a P0, or unblock Production) for the least risk.
   If the score is 100%, ADD a real failing scenario first — it names the next work.
4. Use the relevant agent(s) in `.claude/agents/` for review if non-trivial.
5. **IMPLEMENT only that one change** (smallest safe). Increment `src/version.ts`.
6. Self-review the diff (separate "code exists" from "works").
7. **RE-BENCHMARK + gates**: the benchmark AND `npm run check` AND `npm run build`.
8. **IMPACT_SCOREBOARD** — add a row (score before→after, Δ, change, evidence);
   raise the benchmark FLOOR if the score rose. Update P0_BLOCKERS / PRODUCTION_STATUS / WAR_ROOM_LOG.
9. **RECOMMEND NEXT** highest-ROI task only after the scoreboard is updated.

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
