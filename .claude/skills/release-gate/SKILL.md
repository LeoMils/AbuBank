---
name: release-gate
description: Harshly decide whether AbuAI is ready for serious demo / beta / production. No optimism without evidence.
---

# Release Gate

Be harsh. The default answer is HOLD until evidence proves otherwise.

## Gate checklist (each needs executed evidence)
- [ ] `npm run typecheck` clean
- [ ] `npm run test` 0 failures (record count)
- [ ] `npm run build` exit 0
- [ ] Playwright mobile-chrome specs pass on a FRESH build
- [ ] Deploy health: root 200, buildVersion == commit, chat 200, online 200
- [ ] No exposed secrets (git + grep)
- [ ] No P0 in `P0_BLOCKERS.md` (CODE P0 = blocker; device/account = documented gate)
- [ ] Voice criterion: realtime up OR validated fallback present (state which)
- [ ] Two consecutive QA hostile loops found 0 new P0/P1

## Decision
- SHIP (production): only if ALL above pass AND voice is validated E2E (device or real fallback).
- BETA/DEMO: code green + validated fallback, with device voice pending → allowed, labelled.
- HOLD: any unchecked box → state the exact blocker + owner + shortest path.

Output: GATE_RESULT (SHIP/BETA/HOLD) · evidence table · exact blockers · single next action.
Never output SHIP/BETA without the evidence table.
