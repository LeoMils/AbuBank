# Recommended Hooks (SAFE — recommended, NOT enabled)

These are *recommendations*. None are enabled automatically. To adopt one, add it
to `.claude/settings.json` (or `settings.local.json`) yourself after review. All
are non-destructive: they warn/remind/notify, they do not delete or auto-push.

## 1. Warn before editing secrets/env (PreToolUse: Edit/Write)
Matcher on path `**/.env`, `**/.env.*` → print a warning and require confirmation.
Never block reading `.env.example`. Purpose: stop accidental secret edits/commits.

## 2. Remind to update project_state after code edits (PostToolUse: Edit/Write)
After edits under `src/**` or `api/**`, emit a reminder: "update
.claude/project_state/ (P0_BLOCKERS, PRODUCTION_STATUS, WAR_ROOM_LOG)".

## 3. Run validation after code edits — ONLY if commands exist (PostToolUse)
After `src/**`/`api/**` edits, suggest `npm run check`. Guard: only run if the
script exists in package.json. Do NOT invent `npm run lint` (it does not exist here).

## 4. Notify when human input is needed (Notification)
On any mandatory STOP condition (secrets/env, data-loss, high-risk architecture,
validation cannot run), surface a clear "human decision needed" notice.

## 5. Block accidental production-readiness claims without validation (Stop/PreResponse)
If the response asserts "production-ready / shipped / works" without a referenced
passing command or deploy-health code in the same turn, flag it for revision.

## Explicitly NOT recommended (destructive / risky)
- Auto-commit / auto-push / auto-merge.
- Auto-deploy to production.
- Auto-delete files or IndexedDB stores.
- Auto-editing `memory/*` (it is generated from `knowledge/*`).
- Force-running commands that prompt or block (interactive flags).
