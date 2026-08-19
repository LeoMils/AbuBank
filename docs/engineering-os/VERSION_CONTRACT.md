# AbuBank — Version Truth Contract

**Status:** authoritative. Enforced by `src/version.test.ts`.
**Created:** Foundation Release 1 (formalizes a contract that previously lived only in a test comment).

## The problem this prevents
Two version numbers exist in the repo and looked like a "conflict" in the Phase-0 report:
`package.json` = `30.14.0` vs `src/version.ts` = `0.63.0-realtime-audio-timeout`. They are **not**
a conflict — they are **two intentionally separate lanes**. This document names them so nobody
"fixes" the drift by force-aligning them (which would be wrong).

## The two lanes

| Lane | Source | Value shape | Who sees it | Purpose |
|---|---|---|---|---|
| **Product-build version** (authoritative for humans) | `src/version.ts` → `APP_VERSION.version` | `0.63.0-realtime-audio-timeout` | Martita/Leo in UI (Settings About, Home QA marker, startup log), `/api/health` | The single visible build identity; used to detect a stale cached PWA on device |
| **npm semver** (release/tooling lane) | `package.json` → `version` | `30.14.0` | tooling only; also `import.meta.env.VITE_APP_VERSION` | package/tooling versioning. **MUST NOT appear in any UI surface.** |

## Rules (enforced)
1. **`APP_VERSION.version` is the one authoritative product-build version.** All UI + startup log read it.
2. **`api/health.ts` `BUILD_VERSION`/`BUILD_LABEL` must equal `APP_VERSION.version`/`buildLabel`.**
   Enforced by `src/version.test.ts` (`no manual drift`). This is the client↔server sync point used by
   `src/services/versionSync.ts` (`detectStaleBuild`) to catch a stale iOS PWA bundle.
3. **The npm semver must never appear in a visible UI file.** Enforced by `src/version.test.ts`, which now
   reads the semver **dynamically from `package.json`** (previously it hardcoded the stale literal
   `"30.10.0"`, so it silently stopped guarding once the package version moved to `30.14.0` — fixed in
   Foundation Release 1).
4. **`store.appVersion` is sourced from `APP_VERSION.version`,** not `VITE_APP_VERSION`. Enforced.

## Why not a single source for both?
`api/health.ts` runs in the Vercel Edge runtime and cannot import the TS build config cheaply, so its
`BUILD_VERSION` is a hardcoded string **kept in sync by a test**, not a shared import. That is the
best available single-truth mechanism given the runtime boundary; the test is the contract.

## When you ship a build
Bump `APP_VERSION.version` + `buildLabel` + `buildDate` in `src/version.ts` **and** the matching
`BUILD_VERSION`/`BUILD_LABEL` constants in `api/health.ts`. The test fails if they diverge.
The npm semver (`package.json`) is bumped independently by release tooling and is not user-visible.

## Evidence class
This contract is **CODE**-verified (a deterministic test asserts every rule above). It is not a runtime
device claim.
