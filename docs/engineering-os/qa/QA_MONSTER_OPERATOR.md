# qa:monster — Operator Guide (repository-only; no prior conversation needed)

This is the single entry point to certify AbuBank. It RUNS the already-frozen acceptance scripts and
gates and emits one authoritative machine state (`docs/eval/QA_MONSTER_REPORT.json`). Prose never
promotes a machine NO-GO. **The process exit code is the truth** — CI trusts it.

## Run it

```
npm run qa:monster feature                 # fast local gates (typecheck + full unit suite)
npm run qa:monster rc         <previewUrl>  # certify a deployed Preview RC candidate
npm run qa:monster production <prodUrl>     # verify actual Production (read-only)
```

`rc`/`production` require an explicit `http(s)` URL. The current locked candidate URL + build id live
in `docs/engineering-os/qa/RELEASE_LOCK.json` (`candidateRC`, `buildVersion`).

## Exit codes — what each means and what to do

| code | state | meaning | operator action |
|------|-------|---------|-----------------|
| `0` | `FEATURE_COMPLETE` / `RC_ELIGIBLE` / `FULL_PRODUCTION_VERIFIED` | mode objective met | proceed (RC success = machine-ready; owner gates may still remain — see below) |
| `2` | `USAGE_ERROR` | bad args / missing URL | fix the command |
| `3` | `RC_REJECTED` / `PRODUCTION_NOT_VERIFIED` / `FEATURE_INCOMPLETE` | machine evidence says **not releasable** (NO_GO, NOT_READY, or machine-closable work remains) | read `verdicts.*` + `exit.reason`; close the remaining machine work |
| `4` | `INTEGRITY_FAIL` | **fail-closed**: missing/malformed report, a required area absent (denominator shrink), a crashed/indeterminate area, or an area that claims pass with no materialized evidence (pass-by-omission) | the run itself is untrustworthy — never treat as pass; re-run / fix the harness |

**A missing, malformed, or crashed run is NEVER success.** Exit is derived from the release state
machine in `scripts/qa-monster-verdict.mjs`, not from an area roll-up. That module is proven by
`src/engineering-os/qaMonsterExitContract.test.ts` (13 planted-defect mutations, part of the enforced
suite) — if you change the contract, that test must still pass.

## Interpreting the three verdicts (never conflate them)

- `PRODUCT_CANDIDATE_VERDICT`: `GO` / `NO_GO` / `NOT_PROVEN` — is the *product* good?
- `QA_SYSTEM_VERDICT`: `READY` / `NOT_READY` / `INCOMPLETE_PRODUCTIZATION` — is the *QA system itself*
  productized? (READY requires gates green **and** a runtime-clean worktree **and** Track B complete.)
- `RELEASE_PROMOTION_VERDICT`: `NOT_YET` / `ELIGIBLE_PENDING_OWNER` / ... — may the candidate be
  promoted? `ELIGIBLE_PENDING_OWNER` means the machine did everything it can; **owner** gates remain
  (see `RELEASE_LOCK.json → ownerActionsOpen`: revoke old keys, authorize a clean production deploy).
  Owner authorization changes authority — it can **never** convert failing machine evidence to PASS.

## Current state (read the files, not this line — it can go stale)

At the time this guide was written the candidate is `PRODUCT=GO` but `QA_SYSTEM=INCOMPLETE_PRODUCTIZATION`
(Track B B2–B13 + A5 stochastic sampling remain), so `qa:monster rc` correctly **exits 3** — the QA
system is not yet productized. Authoritative status: `RELEASE_LOCK.json` + `docs/eval/QA_MONSTER_REPORT.json`.
Remaining machine-closable work and exact next actions: `docs/engineering-os/qa/MONSTER_QA_RESUME.md`.
