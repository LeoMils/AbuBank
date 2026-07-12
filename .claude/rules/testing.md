---
description: Engineering rules for tests + evidence honesty
globs: "**/*.test.ts,**/*.test.tsx,**/*.spec.ts,src/eval/**,e2e/**"
alwaysApply: false
---
# Rule: Testing + evidence (engineering)

**Applies to:** all test/eval/e2e files.

- A green unit/integration test is **`CODE` evidence** (or `MOCK` where providers are mocked).
  It NEVER proves `BROWSER` / `PREVIEW` / `PHYSICAL_DEVICE` / `PRODUCTION`. Label honestly.
- **Real user / device evidence overrides passing mocks.** 297 green tests did not predict the
  physical failures on the Acceptance Board — treat that as the standing warning.
- **Every bug becomes a red regression test FIRST** (`failure-to-regression`), before the fix.
  Prefer a generalized regression family over a phrase-specific patch.
- **Never weaken a test to make it pass.** A green test that encodes the bug is a liability;
  fix the truth. Never delete a failing test to unblock.
- Fast commits, strict releases: commits run targeted tests; the full suite is a release/CI gate
  (`docs/engineering-os/RELEASE_TEST_STRATEGY.md`).
