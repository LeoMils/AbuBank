# DECISIONS

## D1 · Do not rebuild what exists (2026-08-13)
The brief presumes a mostly-unQA'd product. Repo scan proves otherwise (12662 green tests, 487
files, 68×68 metamorphic + simulator + invariants already present). **Decision:** do NOT build
parallel QA systems (violates root CLAUDE.md "one runtime path / no parallel evidence systems").
Instead: run the existing estate honestly, fill genuinely empty cells, fix real defects in
severity order. Every new test is red-before-green.

## D2 · Groq key in bundle is NOT a leak defect (2026-08-13)
The built bundle inlines `VITE_GROQ_API_KEY` (`gsk_...`). Verified against
`src/clientProviderKeyContract.test.ts`: free-tier Groq/Gemini keys are **client-allowed by
documented design** (non-billable, rate-limited). `scripts/check-client-secret-leak.cjs` guards
only BILLABLE keys (OpenAI/Azure) and passes. **Decision:** classify as P3 tracked-risk note, not
a P0 leak. Exit criterion #10 (no billable key) is PROVEN. Residual risk (quota abuse of a
scrapable free key) logged in OPEN.md — a proxy/rotation is a product decision for Leo.

## D3 · Highest-ROI first build = mutation harness (Phase M) (2026-08-13)
Rationale: it is the brief's explicitly-named "most important phase", the single biggest empty
cell, and the only thing that MEASURES whether the green suite is real. Approach chosen to be
safe + fast on Windows: mutate one source guard in place, run ONLY the owning test file, assert
it turns red, then restore — per-guard kill verdict — rather than a full-suite run per mutant.
This avoids 12-min full-suite loops and keeps the tree clean (restore is guaranteed in finally).
Start with P0-protecting guards (phone-not-aloud, distress, never-invent, no-announce, dedup,
feminine self-ref). Report kill-rate honestly; each survivor → a new red-before-green test.

## D4 · Version bumped 0.224.0 → 0.225.0 for a QA-tooling+test change (2026-08-13)
Root CLAUDE.md: "Every change must increment and display the version number." Honored despite this
commit touching no product runtime code (new test + harness + docs), because the rule is explicit
and repeatedly emphasized, and a monotonic version helps the PWA staleness diagnostic. Synced all
three contract locations (`src/version.ts`, `api/health.ts`, `src/version.test.ts`) per
VERSION_CONTRACT.md; `version.test.ts` (22) green confirms no drift. Deliberately did NOT set any
`VITE_*` billable key, touch `.env`, or deploy.

## D5 · Fixed a latent pre-commit false-positive, did NOT --no-verify (2026-08-13)
Staging `redaction.test.ts` re-triggered `scripts/precommit-guard.cjs`, which flagged a PRE-EXISTING
fake `sk-` fixture whose body was 20 chars ⇒ it matched the guard's `sk-` + 20-or-more secret rule.
Chose NOT to bypass the hook (repo rule) and NOT to weaken the guard (would let a real secret into a
test file). Instead shortened the FAKE key to 18 chars: still ≥16 so redaction still masks it (the
test's intent is intact, 9/9 green), but <20 so the guard no longer false-positives. Non-weakening,
minimal, keeps the security guard fully armed. My own added ID/number fixtures never matched `sk-`.
