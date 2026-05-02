# Protocol 03 — Safe Feature Branch

Branch hygiene for any commit-bearing task.

## Hard rules

- **Never** push to `main` directly.
- **Never** push to `master`.
- **Never** force push.
- **Never** create a merge commit. Fast-forward only.
- **Never** commit `memory/*`, `.ai-runs/*`, or auto-generated artifacts.

## Branch naming

| Prefix | Use for |
|---|---|
| `feat/<short-slug>` | Product feature work (AbuAI, AbuCalendar, etc.) |
| `chore/<short-slug>` | Workbench infra, docs, cleanup, lockfile maintenance |
| `fix/<short-slug>` | Targeted product bug fix |

## Workflow

1. Start clean: `git checkout main && git pull origin main && git status --short` (must be empty).
2. Create branch: `git rev-parse --verify <branch>` to confirm it does not exist locally; `git ls-remote --heads origin <branch> | grep -q .` to confirm it does not exist remotely. If either returns success, STOP.
3. `git checkout -b <branch>`.
4. Make the smallest scoped change.
5. Validate (see `04-workbench-validation.md`).
6. Stage only the explicitly allowed files. Never `git add .` or `git add -A`.
7. Commit on the feature branch only.
8. Push: `git push -u origin <branch>` (or `--force-with-lease` if rebased; never plain `--force`).

## Workbench enforcement

Workbench v0.4+ branch-safety detects when the current branch is `main` / `master` and emits `recommendedAction: CREATE_FEATURE_BRANCH`. Trust the workbench. Do not commit to main even if validation passes.

## Stop conditions

- Branch already exists → STOP, do not overwrite.
- Working tree is dirty before branch creation → STOP, report and ask.
- Validation fails after the change → STOP, do not commit.
