# Abu Engineering-OS hook guards

Real, tested hooks wired in `.claude/settings.json`. They take effect on the **next Claude Code
session** (settings hooks load at session start). All are **fail-safe**: any internal error →
allow (they never brick the session). Dry-run-verified in Foundation Release 1.

| Guard | Event | Matcher | Effect |
|---|---|---|---|
| `session-start.cjs` | SessionStart | — | Prints branch, build version, working-tree size, open P0, main-branch warning, board link. Informational only. |
| `pretooluse-safety.cjs` | PreToolUse | `Bash` | **Blocks** (exit 2) `git add -A/--all/.`, force-push, `git reset --hard`, `git clean -f`, `vercel --prod`, staging `.env`/`*.local.json`/`*.private.json`/`private/`, and printing a real `.env`. Everything else allowed. |
| `post-edit-light.cjs` | PostToolUse | `Edit\|Write\|MultiEdit` | Non-blocking advisory: scans the edited file for `sk-` tokens, a client read of billable `VITE_OPENAI_API_KEY`, or a real phone number. |
| `claim-check.cjs` | Stop | — | Advisory only (never blocks): reminds when the final message asserts success without a nearby evidence marker. |

## Emergency disable
Set `ABU_HOOKS_DISABLE=1` in the environment — every guard immediately no-ops (exit 0).
Or remove the `hooks` block from `.claude/settings.json`. Or, for a single git action the
PreToolUse guard blocks, run it yourself in a terminal.

## Dry-run (how they were verified)
```
echo '{"tool_name":"Bash","tool_input":{"command":"git add -A"}}' | node .claude/hooks/guards/pretooluse-safety.cjs ; echo exit=$?
echo '{}' | node .claude/hooks/guards/session-start.cjs
```
`_lib.cjs` strips a UTF-8 BOM before JSON.parse (some shells prepend one when piping).

## Design rules
- Fail-safe: block ONLY on a clearly matched dangerous pattern; any error → allow.
- Bounded: 10s timeout each (in settings.json).
- No secrets printed. No infinite loops. Reversible.
