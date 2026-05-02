# Protocol 02 — No-Code Audit

Audit-only mode. The task is investigation, not change.

## Hard rules

- Do not modify any file.
- Do not commit.
- Do not push.
- Do not merge.
- Do not rebase.
- Do not run `npm install` or any command that mutates `package-lock.json`.

## Allowed actions

- `git status`, `git log`, `git diff`, `git show`, `git branch`.
- Read files via the Read tool.
- `grep` / `find` for symbol references.
- `npm run workbench -- --pack <pack> "<neutral task text>"` (workbench may regenerate `memory/*` via `prebuild`; revert immediately after each run).

## After the workbench run

If `prebuild` regenerated memory files:

```
git checkout -- memory/aliases_and_names.yaml memory/family_graph.yaml memory/martita_profile.yaml
```

Confirm `git status --short` is empty before reporting.

## Reporting

State findings without claiming success. Use the wording rules from `06-return-format.md`. If the audit reveals a fixable issue, propose a separate task — do not start fixing in audit mode.

## Stop conditions

- Working tree was already dirty before the audit started → STOP and report.
- Audit reveals a forbidden-path change in someone else's working tree → STOP and report.
- Workbench reports `STOP_REPO_MISMATCH` → STOP and report.
