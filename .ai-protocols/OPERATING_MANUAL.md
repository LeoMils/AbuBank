# AbuBank Claude Code + Workbench Operating Manual

How to operate this repo with small prompts, protocol files, `leo-handoff.md`, and safe merge gates.

## 1. The system in plain English

- `main` should stay `PROVEN / CORE_PROOF_OBSERVED`. Every change passes the workbench truth-contract before merge.
- Claude Code should usually return `leo-handoff.md` (one structured page) instead of full transcripts.
- ChatGPT should decide based on `leo-handoff.md` alone. It only asks for more artifacts when something specific is unclear.
- Full artifacts (`final-report.md`, `static-analysis.json`, etc.) are pasted only when ChatGPT explicitly requests them.

The result: Leo's manual copy-paste burden between ChatGPT and Claude Code is one paste of `leo-handoff.md` per Workbench run, plus `git status --short` for sanity.

## 2. The default tiny prompt template

Paste this into Claude Code as the body of any new task:

```
Use protocol:
.ai-protocols/00-status-delta-direction.md
.ai-protocols/01-repo-guard.md
.ai-protocols/02-no-code-audit.md
.ai-protocols/04-workbench-validation.md
.ai-protocols/07-leo-handoff-first.md

Task:
<write task here>
Do not modify files unless explicitly allowed.
Return leo-handoff.md first.
```

Swap the protocol list for whatever the task actually needs (see templates in §3).

## 3. Templates by task type

### 3.1 No-code audit
```
Use protocol:
.ai-protocols/00-status-delta-direction.md
.ai-protocols/01-repo-guard.md
.ai-protocols/02-no-code-audit.md
.ai-protocols/04-workbench-validation.md
.ai-protocols/07-leo-handoff-first.md

Task:
<audit goal in neutral wording>
Return leo-handoff.md first. Then git status --short.
```

### 3.2 Safe feature branch (product or workbench infra change)
```
Use protocol:
.ai-protocols/00-status-delta-direction.md
.ai-protocols/01-repo-guard.md
.ai-protocols/03-safe-feature-branch.md
.ai-protocols/04-workbench-validation.md
.ai-protocols/06-return-format.md
.ai-protocols/07-leo-handoff-first.md

Task:
On a fresh branch <feat/...|chore/...>:
- <smallest scoped change>
- validate
- commit and push to the feature branch only

Allowed files:
- <explicit list>

Hard rules:
- Do not push to main.
- Do not commit memory/* or .ai-runs/*.
- Stop if validation fails.

Return leo-handoff.md first.
```

### 3.3 Merge gate
```
Use protocol:
.ai-protocols/00-status-delta-direction.md
.ai-protocols/01-repo-guard.md
.ai-protocols/04-workbench-validation.md
.ai-protocols/05-merge-gate.md
.ai-protocols/07-leo-handoff-first.md

Task:
Merge <source-branch> into main, fast-forward only.
Pre-merge: full Workbench validation with neutral wording.
If finalStatus is not PROVEN, stop and report.

Return leo-handoff.md first.
```

### 3.4 Repair continuation
```
Use protocol:
.ai-protocols/00-status-delta-direction.md
.ai-protocols/01-repo-guard.md
.ai-protocols/04-workbench-validation.md
.ai-protocols/06-return-format.md

Task:
The last Workbench run was REQUEST_REPAIR.
See <runFolder>/candidate-next-prompt.md.
Apply only the smallest safe repair.
Re-run validation. Stop if anything else changes.

Return leo-handoff.md first.
```

### 3.5 Commit-ready authorization
```
The latest Workbench run says READY_TO_COMMIT for these files:
- <file>

Authorize Claude Code:
git add <files>
git commit -m "<exact message>"
git push origin <current-feature-branch>

Do NOT push main. Do NOT merge. Do NOT include memory/* or .ai-runs/*.
```

### 3.6 Wrong-repo stop
If `01-repo-guard.md` markers fire (`Dictator`, `zero2026`, `ZeroGameScreen`, etc.) the prompt is for a different repo. Reply:
```
This is AbuBank. The task references <markers>, which belong to a different project. Stopping per .ai-protocols/01-repo-guard.md.
```

### 3.7 Generated memory files handling
After `npm run build` or `npm run workbench`, `prebuild` regenerates `memory/aliases_and_names.yaml`, `memory/family_graph.yaml`, `memory/martita_profile.yaml`. Always:
```
git checkout -- memory/aliases_and_names.yaml memory/family_graph.yaml memory/martita_profile.yaml
git status --short   # must be empty before commit/merge
```
Workbench v0.5.1+ classifies a generated-only diff as `GENERATED_FILES_PRESENT` (not `PROTECTED_BRANCH_DIRTY`). It will refuse to recommend a commit until the revert is done.

### 3.8 Truth-violation handling
If `finalStatus: FAILED / TRUTH_VIOLATION` and the only matches are forbidden success-language inside artifact paths embedded in `final-report.md`, the cause is the task slug. Re-run with neutral wording:
```
npm run workbench -- --pack abobank-ai "<verb> <noun> <neutral context>"
```
Avoid: `fixed`, `working`, `resolved`, `improved`, `enhanced`, `better`, `optimized`, `successful`, `approved`, `partially fixed`, `good enough`, `completed`, `solved` (see `06-return-format.md`).

## 4. What Leo pastes back to ChatGPT

When Claude Code returns, Leo pastes to ChatGPT:

1. `leo-handoff.md` full contents.
2. `git status --short`.

Only paste other artifacts if ChatGPT asks for them by exact name.

## 5. The protocol files (one-liner each)

| File | One-liner |
|---|---|
| `00-status-delta-direction.md` | Open every long-running task with status / delta / direction. |
| `01-repo-guard.md` | Confirm AbuBank; refuse if the task references Dictator / zero2026 / similar. |
| `02-no-code-audit.md` | Audit-only mode; no edits, no commits. |
| `03-safe-feature-branch.md` | Branch hygiene; never push main; fast-forward only. |
| `04-workbench-validation.md` | Standard validation; revert generated `memory/*`; use neutral task wording. |
| `05-merge-gate.md` | Fast-forward merge with full pre-merge audit. |
| `06-return-format.md` | Truth contract; forbidden success-language list; brevity. |
| `07-leo-handoff-first.md` | Paste `leo-handoff.md` first; don't paste full transcripts. |

## 6. What NOT to do

- Do not paste full Claude Code transcripts to ChatGPT by default.
- Do not push to `main` directly. Always go through a feature branch + fast-forward merge.
- Do not commit `memory/*`. Always revert before commit.
- Do not commit `.ai-runs/*`. They are local-only run artifacts.
- Do not ignore `FAILED / TRUTH_VIOLATION`. Re-run with neutral wording or fix the actual claim.
- Do not bypass `STOP_REPO_MISMATCH`. The guard is there because previous prompts have been routed to wrong repos.
- Do not mix AbuBank with Dictator / zero2026 / any other project. They live in different repos.
- Do not amend or force-push `main`.
- Do not `git add .` or `git add -A`. Stage explicit paths only.

## 7. Status percentage rule (for ChatGPT replies)

Every ChatGPT response for this workflow should begin with:

```
- Overall automation goal:        N% / 100%
- Previous checkpoint:            M%
- Delta this run:                 (N - M)%
- Evidence baseline:              <PROVEN / FAILED / NOT_PROVEN, plus reason>
- Current blocker:                <one-liner or "(none)">
- Estimated time to 90% usable:   <hours/days>
- Estimated time to fuller solution: <hours/days>
- Direction check:                <next concrete step>
```

This block keeps the human-in-the-loop oriented across long-running automation work.

## 8. Moving to a new chat

If continuing the work in another chat or with another person, paste:

1. This `OPERATING_MANUAL.md`.
2. The latest `leo-handoff.md` (full contents).
3. The current `main` commit short SHA.
4. The current open task in one sentence.

Do not paste full logs, raw `final-report.md`, or full transcripts unless the new chat asks for them.

## 9. Quick reference

| Question | Answer |
|---|---|
| Where do small prompts live? | In this manual + the `.ai-protocols/` files. |
| What does Claude Code return by default? | `leo-handoff.md` plus `git status --short`. |
| What does ChatGPT decide on? | `leo-handoff.md` only, unless it explicitly asks for more. |
| Where does code change? | On `feat/*` or `chore/*` branches, never directly on `main`. |
| When does main move? | Only via fast-forward merge after a `PROVEN` Workbench audit. |
| What does PROVEN mean? | All gates green: validation, self-tests, regression, static-analysis backlog, truth-scanner. |
