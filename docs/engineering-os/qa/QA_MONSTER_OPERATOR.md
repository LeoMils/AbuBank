# qa:monster — Operator Guide (repository-only; no prior conversation needed)

This is the single entry point to certify AbuBank. It RUNS the already-frozen acceptance scripts and
gates and emits one authoritative machine state (`docs/eval/QA_MONSTER_REPORT.json`). Prose never
promotes a machine NO-GO. **The process exit code is the truth** — CI trusts it.

## Start here — discover the candidate (you do NOT need to know the URL)

```
npm run qa:current            # prints the current candidate (URL, build, runtime, capsule) as JSON
```

`qa:current` derives THE current candidate from repository truth (`RELEASE_LOCK.json`, cross-checked
against the sealed capsule) and is fail-closed: `PROVEN` (exit 0) gives you the exact `certifyCommand`
to run next; `CURRENT_CANDIDATE_NOT_FOUND` (exit 4) or `CURRENT_CANDIDATE_AMBIGUOUS` (exit 3) means the
lock is missing or two artifacts disagree — fix that before certifying. This is the machine-readable
entry point a fresh operator uses without being handed anything.

## Run it

```
npm run qa:monster feature                 # fast local gates (typecheck + full unit suite)
npm run qa:monster rc         <previewUrl>  # certify a deployed Preview RC candidate (auto-seals capsule)
npm run qa:monster production <prodUrl>     # verify actual Production (read-only)
```

Take `<previewUrl>` from `qa:current` (its `candidate.url` / `certifyCommand`). It equals
`RELEASE_LOCK.json → candidateRC`.

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

## Certification Capsule (the proof package — §12)

An `rc`/`production` run automatically seals a content-addressed proof package to
`docs/engineering-os/qa/CERTIFICATION_CAPSULE.json` (`CAPSULE_ID = sha256(canonical contents)`). It
records the certified runtime/artifact/harness identities, runtime-source provenance, both worktree
cleanliness flags, all three verdicts, and a digest of every referenced evidence file — so a future
operator can answer *what was certified, by which harness, with which evidence, and why* from that
file alone. Regenerate/verify manually with:

```
npm run qa:capsule            # seal a capsule from current machine state
npm run qa:verify-capsule     # exit 0 = intact; exit 4 = tampered/evidence-drift/unproven provenance
```

`verify-capsule` proves BOTH **integrity** (content address intact, every referenced evidence file
present + unchanged, provenance `PROVEN`) AND **completeness** — every claim in the authoritative
denominator `docs/engineering-os/qa/REQUIRED_CLAIM_SET.json` is covered, and that denominator has not
drifted since sealing. A capsule can be perfectly hash-consistent yet **incomplete** (dropped a claim,
or a new required claim was added after sealing); completeness catches both. Fails closed (exit 4).
Proven by `src/engineering-os/certificationCapsule.test.ts` (integrity + completeness mutations,
enforced suite).

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
