# AbuBank Claude Code Protocol Pack

Reusable instruction files for keeping Claude Code prompts small, predictable, and safe.

## How to use

In a Claude Code prompt, reference one or more protocol files instead of restating their content:

```
Follow .ai-protocols/00-status-delta-direction.md.
Follow .ai-protocols/01-repo-guard.md.
Follow .ai-protocols/03-safe-feature-branch.md.
Then: <task description with neutral wording>.
```

Claude Code reads each referenced file and obeys it as if it were inlined. Prompts shrink from hundreds of lines to a handful.

## Files

| File | Purpose |
|---|---|
| 00-status-delta-direction.md | Open every long-running task with the status / delta / direction block. |
| 01-repo-guard.md | Hard guard: this is AbuBank, not Dictator / zero2026 / any other project. |
| 02-no-code-audit.md | Audit-only mode: no edits, no commits, no merges. |
| 03-safe-feature-branch.md | Branch hygiene: never push to main, always feat/* or chore/*. |
| 04-workbench-validation.md | Standard validation sequence with neutral task wording. |
| 05-merge-gate.md | Fast-forward only, with full pre-merge audit. |
| 06-return-format.md | Always-on rules for return wording (no forbidden success-language outside policy quotes). |
| 07-leo-handoff-first.md | Paste leo-handoff.md to ChatGPT first; do not paste full transcripts. |

## Inclusion order (typical)

1. `01-repo-guard.md` — first, always
2. `00-status-delta-direction.md`
3. The protocol matching the task type (audit / branch / merge)
4. `06-return-format.md` — last

## Smallest-safe-step rule

If the requested task implies more than one logical change, do only the smallest safe step that can be validated and committed independently. Stop and report. Wait for explicit authorization to continue.

## Stop-if-different rule

If the working tree, branch, repo identity, or task scope does not match the protocol expectation, STOP and report. Do not attempt to repair an unexpected state silently.
