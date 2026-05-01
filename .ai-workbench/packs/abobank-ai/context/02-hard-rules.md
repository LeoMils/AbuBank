# 02-hard-rules — abobank-ai pack

[PROVIDED_BY_LEO] The Truth Contract overrides every other instruction. If a claim cannot be proven, output `NOT_PROVEN`.
[PROVIDED_BY_LEO] Silence, missing evidence, missing validation, missing eval results, or skipped verification is failure of proof — never pass.
[PROVIDED_BY_LEO] The forbidden success language list (`fixed`, `working`, `resolved`, `improved`, `enhanced`, `better`, `optimized`, `successful`, `approved`, `partially fixed`, `good enough`, `completed`, `solved`) is forbidden when status is `NOT_PROVEN`, `MANUAL_REVIEW`, or `FAILED`. A violation flips status to `FAILED` with `TRUTH_VIOLATION`.
[PROVIDED_BY_LEO] Allowed wording when status is not `PROVEN`: `attempted`, `modified`, `changed`, `generated`, `proposed`, `hypothesis`, `requires evidence`, `requires manual review`, `not proven`.
[PROVIDED_BY_LEO] Source priority is `VERIFIED_FROM_TEST > VERIFIED_FROM_CODE > RUNTIME_ARTIFACT > PROVIDED_BY_LEO > UNKNOWN`. Lower-priority conflicting facts are `INVALIDATED`.
[PROVIDED_BY_LEO] At least one of `core_functionality`, `main_user_flow`, `critical_bug_fix` must be PROVEN with HIGH confidence. Otherwise the run is `FAILED` with `NO_CORE_PROOF`.
[PROVIDED_BY_LEO] Drift in unrelated features is `FAILED`. Suspected-but-unproven drift is `MANUAL_REVIEW` with `POSSIBLE_DRIFT`. Without a baseline, drift is `UNKNOWN_BASELINE` and not "checked".
[PROVIDED_BY_LEO] Every new function or module must have a real reachable call site, OR an explicit test-only reason. A call site is reachable only if it is in a real user flow OR covered by test execution.
[PROVIDED_BY_LEO] No broad refactors. No dead code. No redesigns unless explicitly requested.
[PROVIDED_BY_LEO] No silent edits to `package.json` / `package-lock.json` / `.env*` / secrets. Any of those flips the run to `HUMAN_APPROVAL_REQUIRED`.
[PROVIDED_BY_LEO] Hebrew/RTL and 80+ usability are mandatory. Touch targets ≥ 48 px. Text ≥ 16 px. High contrast on dark background.
[PROVIDED_BY_LEO] If TTS fails, show a non-blocking message but never block the visual confirmation button. The visual button is the always-on fallback.
[PROVIDED_BY_LEO] Never save an appointment without an explicit voice or button confirmation. "Implicit save" is a Truth Violation.

[VERIFIED_FROM_CODE] CLAUDE.md (project root) defines additional product rules. Those rules are inherited by this pack.
[VERIFIED_FROM_CODE] `src/.../privacy-boundaries.md`, `emotional-accuracy.md`, `calendar-date-integrity.md`, `senior-ux.md` (under `.claude/rules/`) are the canonical product rules. Workbench packs do not override them.
