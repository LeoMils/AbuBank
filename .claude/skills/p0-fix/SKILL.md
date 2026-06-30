---
name: p0-fix
description: Fix exactly one P0 blocker with the smallest safe change, validated. Use when a specific P0 is identified.
---

# P0 Fix

Fix ONE P0 blocker. No scope creep.

## Workflow
1. Read the blocker from `.claude/project_state/P0_BLOCKERS.md`.
2. Inspect the exact files (Grep/Read). Separate "code exists" from "works".
3. Plan the SMALLEST safe fix (prefer a targeted edit over a rewrite).
4. Implement only that one change. Increment the version (`src/version.ts`).
5. Validate with real commands (`npm run check`; targeted test for the fix).
6. Update `P0_BLOCKERS.md` + `PRODUCTION_STATUS.md` + `WAR_ROOM_LOG.md`.
7. Recommend the next P0.

## Rules
- Never weaken a test to make it pass.
- If the "fix" needs an env/secret/architecture change or risks data loss → STOP
  and escalate (mandatory stop condition).
- Reproduce the failure with an assertion BEFORE fixing; keep that assertion as the regression test.

## Done definition
Failing case now passes via an executed assertion; full `npm run check` green; state updated.
