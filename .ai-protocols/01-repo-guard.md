# Protocol 01 — Repo Guard

Before any action, confirm the active repo is **AbuBank**.

## Identity markers (positive)

The repo is AbuBank if any of these hold:

- `src/screens/AbuAI/` exists.
- `src/screens/AbuCalendar/` exists.
- `package.json` name is `abu-bank`.
- `CLAUDE.md` mentions Martita.

## Contamination markers (must not appear)

If the task text or working tree references any of these, **STOP**:

- `Dictator` (game project; different repo)
- `zero2026` or `src/zero2026/` (different repo)
- `ZeroGameScreen`, `ActionDock`, `FactionRail`, `StatusStrip` (game UI; different repo)
- Any path or symbol that does not exist in this repo and was not introduced in a referenced file

## Workbench enforcement

Workbench v0.4+ runs `repo-mismatch.json`. If `status: STOP_REPO_MISMATCH`, the run halts. Trust the workbench guard. Do not edit when the guard fires.

## Stop-if-different rule

If the task references files that don't exist here, or if the repo identity is unclear (e.g. detached HEAD, unfamiliar branch), STOP and report. Ask before proceeding.

## What the guard does NOT do

- Does not block legitimate AbuBank tasks that mention "calendar" or "voice" — only foreign project names.
- Does not block reading documentation that mentions other projects in passing.

If unsure, stop and ask.
