# NORTH_STAR

## The one goal
Martita (80+, Hebrew + Rioplatense Spanish, on an installed PWA) feels she is
talking to a **warm, smart friend who listens, remembers, explains, and helps** —
never an assistant, a menu, a caregiver, or a dead-end.

## The one number
**BENCHMARK_SCORE** = % of real user-moments that behave correctly, measured by
`src/screens/AbuAI/benchmarkConversations.ts` (runnable, deterministic).
Run it: `npx vitest run src/screens/AbuAI/benchmarkConversations.test.ts`.
Each scenario is a real moment from Leo's device transcripts + companion spec.

A change is worth doing ONLY if it raises BENCHMARK_SCORE for the user, removes a
P0, or is required to reach Production. Elegance, refactors, and test-count are NOT
the goal.

## The cycle (every work cycle, in order)
1. Read NORTH_STAR (this file).
2. Run BENCHMARK_CONVERSATIONS → record the score + the failing moments.
3. Pick the SINGLE change with the highest user-ROI (biggest score gain / P0 /
   production unblock for the least risk). Prefer a failing benchmark moment.
4. Implement ONLY that change (smallest safe).
5. Re-run ALL benchmarks + `npm run check`.
6. Update IMPACT_SCOREBOARD (before → after, delta, what moved).
7. ONLY THEN recommend the next task.

## Guardrails
- Do NOT add new agents/skills unless you can prove they raise BENCHMARK_SCORE or
  unblock Production. The benchmark is code, not an agent.
- Most Hebrew UI is by design — do not mass-localize. Localize only moments the
  user must ACT on (e.g. failure/offline copy).
- Evidence beats assumptions. A benchmark run is HIGH evidence; a grep is MEDIUM.
