# Protocol 00 — Status / Delta / Direction

Open every long-running task by stating three things, in order, before doing any work.

## Status

- Repo identity (always AbuBank — see `01-repo-guard.md`).
- Current branch.
- main HEAD short SHA.
- Working tree state (clean or dirty, with file list).
- Last known Workbench result (finalStatus, finalReason, raw NOT_PROVEN_NO_USAGE, decision-required count, self-test totals).

## Delta

- What changed since the previous checkpoint in this thread.
- New commits on main (count + top SHAs).
- New artifacts produced.
- Any drift from the previous "ready" state.

## Direction

- What this task is.
- What this task is NOT.
- Hard rules (do/don't list).
- Allowed file scope.
- Stop conditions.

## Why

This block makes context cheap to verify and keeps the rest of the prompt short. If status or delta is wrong, stop and surface the mismatch — do not proceed.

## Smallest-safe-step rule

If the task implies multiple logical changes, do only the smallest one that can be validated and committed independently. Stop and report. Wait for explicit authorization before continuing.
