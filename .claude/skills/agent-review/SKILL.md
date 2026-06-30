---
name: agent-review
description: Have the relevant specialized agents review the current state or current diff. Use before a gate or after a risky change.
---

# Agent Review

Get independent expert review. No agent approves its own work.

## Workflow
1. Determine scope: whole current state, or the current `git diff`.
2. Select the relevant agents (`.claude/agents/`) by the files/domains touched:
   - voice → voice-ai-engineer; calendar → calendar-engineer; memory/family →
     memory-graph-engineer; api → backend-lead; mobile/PWA → mobile-engineer;
     copy/tone → product-ux-reviewer; always include qa-failure-engineer +
     security-privacy-engineer for a gate.
3. Each agent returns: FINDING · EVIDENCE · FILES · SEVERITY (P0-P3) · CONFIDENCE
   · RECOMMENDED_ACTION.
4. production-commander synthesizes: top-5 P0, production probability, single next action.

## Rules
- Reviewers must cite executed evidence, not assumptions.
- Conflicts are resolved by production-commander toward the shortest production path.
