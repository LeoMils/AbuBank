# Release & Test Execution Strategy — fast commits, strict releases

The old model ran the entire 297-file vitest suite on **every commit**. It was slow, occasionally
crashed the worker (OOM), and pushed people toward `git commit --no-verify` — which silently
removed the gate entirely. Foundation Release 1 splits the two concerns.

## 1. Commit-time (FAST) — `.githooks/pre-commit` → `scripts/precommit-guard.cjs`
Runs in ~1–3s. Does NOT run the suite. Checks:
- staged-file inventory;
- privacy/secret scan (fail-closed): blocks `.env`/`*.local.json`/`*.private.json`/`private/`,
  `sk-…` tokens, and real phone numbers in committed source/data;
- version-contract consistency (`src/version.ts` ↔ `api/health.ts` `BUILD_VERSION`);
- `npm run validate:family` **only** when `knowledge/family_data.json` is staged.

Bypass (rare, intentional): `git commit --no-verify` or `ABU_HOOKS_DISABLE=1`.

## 2. Capability-targeted (during work)
Run the tests for what you touched, not everything:
```
npx vitest run src/screens/AbuAI/calendarCreate.test.ts        # a specific file
npx vitest run src/screens/AbuCalendar                          # a folder
npx vitest run -t "follow-up"                                   # by test name
```

## 3. Release / CI gate (STRICT) — the full suite
CI (`.github/workflows/ci.yml`) already runs the strict gate on push/PR to `main`:
`npx tsc --noEmit` → `npx vitest run` → `npx vite build`. Locally, run the SAME gate before a
release, sequentially (never build + test at once):
```
# 1) typecheck
npx tsc --noEmit
# 2) full suite, deterministic single-worker (stable; avoids parallel-worker OOM), raw log kept
npx vitest run --pool=forks --poolOptions.forks.singleFork 2>&1 | tee docs/eval/full-suite.raw.log
# 3) build (separate step, after tests finish)
npm run build
```

## 4. Classify failures honestly (do not lump them together)
When the suite fails, tag each failure:
- **CODE_ASSERTION** — a real `expect` failed. This is a product/logic bug. Fix the truth.
- **CONFIGURATION** — bad path/import/tsconfig/test setup. Fix config, not product.
- **ENVIRONMENT_OOM** — worker crashed / out of memory (not an assertion). Re-run single-worker;
  it is NOT a passing signal and NOT a code failure — record it as an environment limit.
- **TOOLING** — vitest/tsx/node/runner issue.
- **EXTERNAL_SERVICE** — a live provider/network call failed (only for opt-in live tests).

Only **CODE_ASSERTION** blocks a release on correctness grounds; the others are triaged to their
owner. Never report ENVIRONMENT_OOM as "tests passed" or as "code failing".

## 5. Evidence class of a suite run
A green full suite is **CODE** evidence (or **MOCK** where providers are mocked). It never proves
BROWSER/PREVIEW/PHYSICAL_DEVICE/PRODUCTION. Preview/device rows on the Acceptance Board need their
own evidence (see `preview-verification` / device retest).
