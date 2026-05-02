# Protocol 05 — Merge Gate

How to merge a feature branch into main.

## Hard rules

- Fast-forward only. **Never** create a merge commit.
- **Never** force push.
- **Never** squash if fast-forward is possible.
- **Never** push to main while the workbench audit is FAILED for any reason — including TRUTH_VIOLATION.
- The full pre-merge audit must run on the source branch.

## Pre-merge sequence

1. `git checkout <source-branch>`.
2. `git fetch origin`.
3. `git pull origin <source-branch>`.
4. `git status --short` — must be empty.
5. Run `04-workbench-validation.md` with neutral task wording.
6. Confirm final-report and evidence-check show `PROVEN / CORE_PROOF_OBSERVED`.
7. Confirm `truth matches: 0`.
8. If `git rebase origin/main` is needed (because main moved), use `--force-with-lease` to push, never plain `--force`.

## Merge sequence

1. `git checkout main`.
2. `git pull origin main`.
3. `git merge --ff-only <source-branch>`.
4. If fast-forward fails → STOP. Do not create a merge commit. Report and ask.
5. `git push origin main` (no flags).

## Post-merge audit

Run one workbench audit on main with neutral wording. Verify:

- `finalStatus: PROVEN`.
- `truth matches: 0`.
- `raw NOT_PROVEN_NO_USAGE` did not regress.
- `decision-required count` did not regress.
- The committed file list matches the expected list.

Revert any `prebuild`-regenerated `memory/*`.

## Stop conditions

- Pre-merge workbench is anything other than PROVEN → STOP.
- Truth-scanner fires on the slug → re-run with neutral wording before merging.
- Source branch is behind main → rebase first (with `--force-with-lease`), then re-validate.
- Working tree dirty at any step → STOP and report.
