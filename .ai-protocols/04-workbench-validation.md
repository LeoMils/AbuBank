# Protocol 04 — Workbench Validation

Standard validation sequence. Run once per task; do not duplicate.

## Sequence

```
npm test
npm run typecheck
npm run build
npm run workbench -- --pack abobank-ai "<neutral task text>"
```

## Memory revert

`npm run build` (and the workbench's own `prebuild`) regenerate `memory/*`. After each command that runs the build, revert:

```
git checkout -- memory/aliases_and_names.yaml memory/family_graph.yaml memory/martita_profile.yaml
```

After reverting, confirm `git status --short` shows only the intended diff.

## Neutral task wording rule

The workbench truth-scanner flags forbidden success-language as `TRUTH_VIOLATION` and flips the run to `FAILED`. The slug derived from the task text is embedded in artifact paths inside `final-report.md`, so even path-level mentions trigger the scanner.

**Avoid these words in the task slug**:

- `fixed`
- `working`
- `resolved`
- `improved`
- `enhanced`
- `better`
- `optimized`
- `successful`
- `approved`
- `partially fixed`
- `good enough`
- `completed`
- `solved`

**Use neutral wording instead**:

- `attempted`, `modified`, `changed`, `generated`, `proposed`
- `verification`, `audit`, `check`, `wording`, `safety`
- Past-tense factual verbs are OK if not on the forbidden list (`removed`, `added`, `annotated`, `merged` are fine).

## What "passing" means

| Signal | Meaning |
|---|---|
| `finalStatus: PROVEN` + `finalReason: CORE_PROOF_OBSERVED` | Workbench fully passed. |
| `finalStatus: FAILED` + `finalReason: TRUTH_VIOLATION` | Truth-scanner flagged the slug or report — STOP and re-run with neutral wording. |
| `finalStatus: FAILED` + `finalReason: V0_*_SELF_TEST_FAILED` | Workbench infra regression — STOP and report. |
| `finalStatus: FAILED` + other reasons | Real evidence gap — see repair-prompt.md. |

## Stop conditions

- Workbench truth-scanner fires → STOP, re-run with neutral wording before continuing.
- Self-test fails → STOP, this is workbench infra damage.
- Tests / typecheck / build fail → STOP, fix before commit.
