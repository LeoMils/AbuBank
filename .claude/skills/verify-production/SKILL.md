---
name: verify-production
description: Run all REAL validation commands and report build/test/runtime evidence. Use to prove (not assume) readiness.
---

# Verify Production

Run only REAL repo commands. Do not invent scripts. Distinguish build vs test vs
runtime evidence.

## Commands (from VALIDATION_COMMANDS.md)
1. `npm run typecheck`        → record clean/errors
2. `npm run test`            → record passed/failed counts
3. `npm run build`           → record exit code
4. `npm run build && npm run preview` then the two Playwright specs (mobile-chrome)
5. `npm run validate:family` → family-data integrity
6. Deploy health: `curl <deploy>/api/health`, chat, online, realtime-token

## Reporting rules
- A command that does not exist (e.g. `npm run lint`) → report MISSING, do not fake it.
- A skipped command → report NOT RUN (counts as not-pass).
- HIGH evidence = executed test/command output; MEDIUM = source grep; ZERO = claim.
- Output a table: command · result · evidence-class.

## Output
PASS/FAIL per command + a one-line honest verdict (no optimism without evidence).
