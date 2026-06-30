---
name: production-war-room
description: Run the shortest cycle from current repo state to a production decision. Use when triaging AbuAI production readiness.
---

# Production War Room

Shortest loop from "current state" to "one next action".

## Workflow
1. Load `.claude/project_state/` (CURRENT_STATE, PRODUCTION_STATUS, P0_BLOCKERS, NEXT_ACTION).
2. Run production triage with EVIDENCE (do not assume):
   - `npm run check` (typecheck + test)
   - `npm run build`
   - deploy health: `/api/health`, chat, online, realtime-token
   - secrets: `git ls-files | grep .env`; grep `sk-` in src/api
3. Invoke required agents (production-commander always; plus the domain agents
   relevant to the findings).
4. Identify P0 blockers; separate CODE P0 from device/account/non-code.
5. Pick exactly ONE next action (smallest safe, production-moving).
6. STOP if any mandatory stop condition (see `.claude/CLAUDE.md`) is hit; else proceed.
7. Update `project_state/` (PRODUCTION_STATUS, P0_BLOCKERS, WAR_ROOM_LOG) + re-score.

## Output
Top-5 P0 · production probability today (evidence) · shortest path · single next action.
