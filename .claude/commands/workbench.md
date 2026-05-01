# /workbench

Local Workbench for evidence-based AI work on AbuBank.

## Usage

```
npm run workbench -- --pack abobank-ai "task text in plain Hebrew or English"
```

The Workbench will:

1. Load `.ai-workbench/config.json` and the selected pack (`.ai-workbench/packs/<pack>/context/*.md` + `evals/*.json`).
2. Create `.ai-runs/<timestamp>-<pack>-<slug>/`.
3. Generate `claude-prompt.md` (mission + evidence-tagged context + evals + Truth Contract + safety gates).
4. Run only the validation scripts that exist: `typecheck`, `lint`, `test`, `build`. Skipped commands are recorded as `SKIPPED_NOT_AVAILABLE` and are not pass.
5. Scan for forbidden success language in result/status sections of the generated prompt and final report. A match outside policy quotes flips the run to `FAILED` with `TRUTH_VIOLATION`.
6. Write `evidence-check.json`, `regression-check.json`, `drift-check.json`, `truth-violations.json`, `source-conflicts.json`, `eval-results.json`, `validation.txt`, `final-report.md`.
7. Print the run folder and the artifact paths.

## What v0.1 does NOT do

- Does not run Claude Code automatically.
- Does not auto-commit, auto-push, or auto-merge.
- Does not execute most app-level evals — they default to `NOT_PROVEN / LOW` until mapped to an automated assertion.
- Does not edit `.env*`, `package.json`, `package-lock.json`, `memory/*`, or files outside the active pack's `allowedPaths`.

## Status values

`PROVEN` · `NOT_PROVEN` · `MANUAL_REVIEW` · `FAILED`

`MANUAL_REVIEW` is not approval. `NOT_PROVEN` is not pass.

## Confidence

`HIGH` (automated assertion / deterministic output / runtime artifact) · `MEDIUM` (partial / static evidence) · `LOW` (manual-only / not executable; default).

## Manual loop

1. Run the workbench with the task text.
2. Open `claude-prompt.md` in the run folder. Paste it into Claude Code.
3. Re-run the workbench against the resulting branch state to validate.

## Add a pack

1. Create `.ai-workbench/packs/<pack>/context/00-master.md`. Every factual line begins with `[VERIFIED_FROM_TEST]`, `[VERIFIED_FROM_CODE]`, `[RUNTIME_ARTIFACT]`, `[PROVIDED_BY_LEO]`, or `[UNKNOWN]`.
2. Create `.ai-workbench/packs/<pack>/evals/<eval>.json`. Each eval has `id`, `category`, `mandatory`, optional `mappedTest` (path of the asserting test, or `null`).
3. Add the pack entry to `.ai-workbench/config.json` under `"packs"` with `allowedPaths`, `forbiddenPaths`, and limits.
