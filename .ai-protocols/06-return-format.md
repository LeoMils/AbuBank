# Protocol 06 — Return Format

Always-on rules for what Claude Code writes back.

## Truth contract

If a claim is not verified by an automated test, deterministic output, runtime artifact, or reachable call-site evidence, mark it `NOT_PROVEN`. Do not fake confidence.

## Forbidden success language

In result / status / next-step sections, do not use:

- `fixed`, `working`, `resolved`, `improved`, `enhanced`, `better`, `optimized`, `successful`, `approved`, `partially fixed`, `good enough`, `completed`, `solved`.

These trip the workbench truth-scanner and flip the run to `FAILED / TRUTH_VIOLATION`. Even quoted forms inside artifact paths count.

## Allowed wording when status is not PROVEN

- `attempted`, `modified`, `changed`, `generated`, `proposed`
- `hypothesis`, `requires evidence`, `requires manual review`, `not proven`

## Reply structure

Match the user's requested format exactly. If the user asked for a numbered list 1–N, return exactly N items in order. Do not add unsolicited sections.

## Brevity

- One sentence of communication before each tool call (state what's about to happen).
- Two sentences for end-of-turn summary: what changed and what's next.
- No marketing tone.
- No emojis unless the user explicitly asked.
- No restating instructions back to the user.

## Code reference style

Use `path/to/file.ext:line` so the user can click through.

## Honest unknowns

If something cannot be proven from the current evidence, write `(unknown)` or `requires evidence`. Do not guess and do not paper over.
