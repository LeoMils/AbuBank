# AI Workbench v0.1 — Truth-Enforced Edition

Local, evidence-first preparation layer for AI-assisted work on AbuBank.

This is **infrastructure only**. It replaces the chaotic "ChatGPT → Leo → Claude Code → Leo → ChatGPT" preparation/review loop with a single command that:

- assembles the relevant **context pack** (evidence-tagged facts about the repo)
- assembles the relevant **eval pack** (deterministic acceptance criteria)
- generates a single `claude-prompt.md` Leo can paste into Claude Code
- runs the project's existing validation scripts (`typecheck`, `lint`, `test`, `build`) when available
- writes evidence, regression, drift, truth-violation, and source-conflict reports
- emits one `final-report.md` with an explicit status and confidence

It does **not** ship behavior. It produces evidence and prompts.

## What v0.1 does

- Reads `.ai-workbench/config.json` and the selected pack's `context/` and `evals/`.
- Classifies the task into one or more buckets (PRODUCT_SPEC, AI_PERSONA, FREESPEECH, CALENDAR_VOICE, REMINDERS, WEB_ONLINE, TOOL_GROUNDING, UI_UX, AUTOLOGIN, BUGFIX, TESTS, INFRA, OTHER).
- Generates `claude-prompt.md` containing the mission, classification, evidence-tagged context, evals, allowed/forbidden paths, the Truth Contract, the No-Silent-Success rule, the Source Priority, the Minimum Proof Requirement, the Drift Detector rules, and the exact output format Claude Code must produce.
- Runs `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` — only the ones that exist. Missing scripts are recorded as `SKIPPED_NOT_AVAILABLE`. **Skipped is not pass.**
- Writes `validation.txt`, `eval-results.json`, `evidence-check.json`, `regression-check.json`, `drift-check.json`, `truth-violations.json`, `source-conflicts.json`, and `final-report.md` into `.ai-runs/<timestamp>-<pack>-<slug>/`.
- Refuses to call any run "approved" unless mandatory evals are PROVEN with HIGH confidence.

## What v0.1 does NOT do yet

- Does **not** run Claude Code automatically (no headless / SDK execution).
- Does **not** execute every eval. Most evals are static — they require a mapped automated test to be PROVEN. Without one they default to **NOT_PROVEN** with **LOW** confidence.
- Does **not** auto-commit, auto-push, or auto-merge.
- Does **not** ship a dashboard.
- Does **not** open or comment on PRs.
- Does **not** edit `.env` / `.env.*` / secrets.
- Does **not** delete files.

If `package.json` or `package-lock.json` changed since the last commit, the run is marked `HUMAN_APPROVAL_REQUIRED`.

## Why this is evidence-based

Most LLM tooling reports "success" on the basis of "the model said so". Workbench v0.1 does the opposite: a run cannot be marked **PROVEN** unless an automated test, deterministic function output, runtime artifact, or concrete generated artifact actually showed it. This is the **Truth Contract**.

### Truth Contract

> If the system cannot prove correctness, it must prefer NOT_PROVEN over any misleading success signal.

### No Silent Success

If the system cannot explicitly prove success, it explicitly reports `NOT_PROVEN`, `MANUAL_REVIEW`, or `FAILED`. Silence, missing evidence, missing validation, missing eval results, or skipped verification is **failure of proof**, not pass.

### Truth Violation

If the generated prompt or final report uses forbidden success language (`fixed`, `working`, `resolved`, `improved`, `enhanced`, `better`, `optimized`, `successful`, `approved`, `partially fixed`, `good enough`, `completed`, `solved`) while status is `NOT_PROVEN`, `MANUAL_REVIEW`, or `FAILED`, the truth-violation checker flips status to `FAILED` with reason `TRUTH_VIOLATION`, confidence `HIGH`. There is no warning; it does not downgrade.

Allowed wording when status is not `PROVEN`:
`attempted`, `modified`, `changed`, `generated`, `proposed`, `hypothesis`, `requires evidence`, `requires manual review`, `not proven`.

### Source Priority

When facts conflict:

1. `VERIFIED_FROM_TEST`
2. `VERIFIED_FROM_CODE`
3. `RUNTIME_ARTIFACT`
4. `PROVIDED_BY_LEO`
5. `UNKNOWN`

Lower-priority conflicting facts are marked `INVALIDATED`. If the conflict affects task safety or behavior, the run is marked `STOP_HUMAN_REVIEW`.

### Minimum Proof Requirement

For any task, at least one of `core_functionality`, `main_user_flow`, or `critical_bug_fix` must be PROVEN with HIGH confidence. If none is, the run is marked `FAILED` with reason `NO_CORE_PROOF`. The final report says **NOT READY FOR AUTO-APPROVAL**.

### Drift Detector

If unrelated-feature behavior changed, no-touch paths were touched, or a previously-verified flow stopped behaving the same way, the run is marked `FAILED` with reason `DRIFT_DETECTED`. If drift is suspected but cannot be proven, the run is marked `MANUAL_REVIEW` with risk `POSSIBLE_DRIFT`. Without a baseline, drift cannot be checked, so the report says `UNKNOWN_BASELINE` and **does not pretend the check ran**.

## Status values

- **PROVEN** — an automated test, deterministic function output, runtime artifact, or concrete generated artifact actually showed it.
- **NOT_PROVEN** — the system could not prove it. Default for every eval that has no mapped automated check. **NOT_PROVEN is not a pass.**
- **MANUAL_REVIEW** — required: a human must check this before approval. **MANUAL_REVIEW is not approval.**
- **FAILED** — proof shows the opposite, or a truth violation, regression, drift, or missing-core-proof condition triggered.

## Confidence values

- **HIGH** — automated assertion, deterministic output, runtime artifact, or concrete artifact proof.
- **MEDIUM** — partial verification, static evidence, or limited coverage.
- **LOW** — manual-only or not executable. Default when no automated check exists.

## How Leo uses `claude-prompt.md`

1. Run `npm run workbench -- --pack abobank-ai "task here"`.
2. Open the generated `.ai-runs/<timestamp>-<pack>-<slug>/claude-prompt.md`.
3. Paste it into Claude Code.
4. When Claude Code returns its work, run the workbench again to validate.

The prompt embeds: the mission, evidence-tagged context, the evals, allowed/forbidden paths, safety gates, the Truth Contract, the No-Silent-Success rule, the Source Priority, the Minimum Proof Requirement, the Drift Detector, the forbidden-success-language rule, and the exact output format Claude Code must follow.

## How to run

```
npm run workbench -- --pack abobank-ai "test run only: inspect AbuAI grounding status"
```

Reports land in `.ai-runs/<timestamp>-<pack>-<slug>/`. The full list of artifacts is at the bottom of the run's `final-report.md`.

## How to create a new pack

1. Create `.ai-workbench/packs/<pack-name>/context/` with at least `00-master.md`. Every factual line must start with one of `[VERIFIED_FROM_CODE]`, `[VERIFIED_FROM_TEST]`, `[RUNTIME_ARTIFACT]`, `[PROVIDED_BY_LEO]`, `[UNKNOWN]`. Untagged factual lines are rejected.
2. Create `.ai-workbench/packs/<pack-name>/evals/` with at least one JSON file. Each eval must declare an `id`, a `category`, an `input` (what to feed), an `expected` (what to assert), and a `mappedTest` (the path of the automated test that PROVES it, or `null`).
3. Add the pack to `.ai-workbench/config.json` under `"packs"` with `allowedPaths`, `forbiddenPaths`, and limits.

## Safety gates

- Never pushes, merges, or commits.
- Never edits `.env*` or secrets.
- Never deletes files.
- If `package.json` / `package-lock.json` changed, marks `HUMAN_APPROVAL_REQUIRED`.
- If forbidden paths were touched, marks `FAILED`.
- If unrelated paths were touched, marks `MANUAL_REVIEW` with `RISK_UNRELATED_CHANGE`.
- If forbidden success language appears without proof, marks `FAILED` with `TRUTH_VIOLATION`.
- If no `core_functionality` / `main_user_flow` / `critical_bug_fix` is PROVEN with HIGH confidence, marks `FAILED` with `NO_CORE_PROOF`.

## Manual setup required

- Make sure `npm install` ran at least once. The workbench shells out to `npm run …`.
- The workbench generates artifacts only. Pasting `claude-prompt.md` into Claude Code is **manual** and intentional in v0.1.

## Why v0.1 does not run Claude Code automatically

Auto-execution closes the loop and removes the human checkpoint. v0.1 keeps the human in the loop deliberately. Auto-execution is a separate, future, opt-in capability — and only after the truth-enforcement layer here has proven itself.
