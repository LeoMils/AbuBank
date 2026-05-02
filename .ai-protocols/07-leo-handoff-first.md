# Protocol 07 — Leo Handoff First

The v0.6 workbench writes `leo-handoff.md` into every run folder. This is the only file Leo should usually paste into ChatGPT.

## Default Leo workflow

1. Run the workbench.
2. Open `<runFolder>/leo-handoff.md`.
3. Paste it into ChatGPT first. Do not paste anything else.
4. If ChatGPT asks for more detail, paste the specific referenced artifact:
   - `review-prompt.md` for reviewer-decision detail.
   - `candidate-next-prompt.md` for the exact next Claude Code prompt.
   - `orchestrator-summary.md` for human-readable run summary.
   - `loop-state.json` for current state machine value.

## Default Claude Code workflow

When Claude Code receives a follow-up prompt referencing a previous workbench run:

1. Read the run's `leo-handoff.md` first.
2. Read `claude-next-prompt.md`. Obey its `Status` field:
   - `NO_ACTION_REQUIRED` → do not invent work; wait for an explicit task.
   - `READY_TO_COMMIT` → wait for explicit Leo authorization before committing/pushing.
   - `MANUAL_REVIEW_REQUIRED` → state what the user must decide; do not modify files.
   - `REPAIR_READY` → see embedded `candidate-next-prompt.md`.
3. Only read `final-report.md`, `static-analysis.json`, or other large artifacts if the task explicitly requires them.

## What NOT to paste

- Full Claude Code transcripts.
- Full `final-report.md`.
- Full `validation.txt`.
- Full `static-analysis.json` or `evidence-check.json`.
- Any `memory/*` file.
- Any `.ai-runs/*` folder content (raw).

## Authorization invariant

Even when `claude-next-prompt.md` says `READY_TO_COMMIT`, Leo must explicitly authorize the commit + push. The packet authorizes Claude Code to act ONLY when Leo says so.

## Stop conditions

- `leo-handoff.md` references a run folder that doesn't exist → STOP, ask for the actual run.
- `claude-next-prompt.md` says `MANUAL_REVIEW_REQUIRED` → STOP, request the user's decision before any edit.
- `claude-next-prompt.md` says `READY_TO_COMMIT` but Leo has not authorized → wait, do not commit.
