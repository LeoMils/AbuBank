# EXIT CRITERIA — live status

Status: ✅ met · 🟡 partial · 🔴 not met · ⬜ not yet assessed.
Assessed at Run 1 (2026-08-13), baseline green.

| # | criterion | status | evidence / note |
|---|---|---|---|
| 1 | Zero P0 across full run | 🟡 | No new code-P0 found; all prior code-P0 fixed per board. Device-P0s remain device-only. |
| 2 | Zero P1 across full run | 🟡 | None found this session; app/platform techniques not yet exhausted. |
| 3 | Mutation kill-rate 100% on P0/P1 | 🟡 | Harness built; **100% on 10 seeded mutants** across Brain/Online/Privacy/App (2 real survivors found + closed). Not ✅ until Platform + App-RTL/nav/overflow (Playwright) + Journeys seeded (~30 total). |
| 4 | Every historical defect has a regression test | 🟡 | Large regression estate exists; a defect→test census not yet produced. |
| 5 | All invariants hold in every corpus convo | 🟡 | Invariants encoded but key-gated; no always-on deterministic runner. |
| 6 | 68×68 pairs consistent both directions | ✅ | `familyReasonerProperties.test.ts` (green in suite). |
| 7 | Judge agreement > 80% | ⬜ | Judge exists (`conversationQualityJudge`); agreement not re-measured this session. |
| 8 | Every screen: render/overflow/contrast/target/RTL | 🟡 | Partial Playwright coverage; no single enforced per-screen sweep. |
| 9 | All nine journeys pass end-to-end | 🟡 | Most have e2e specs; not run as a labelled 9-journey suite this session. |
| 10 | No API key in client bundle (grep the build) | 🟡 | **PROVEN: no billable key** (grep + guard). Free-tier Groq present by documented allowance. |
| 11 | Deployment path documented + dry-run | 🟡→🟢(mech) | Fully documented in `PRODUCTION_PATH.md`; build step dry-run GREEN; deploy/alias need Vercel auth (human, STOP condition). |
| 12 | Rollback proven | 🟡 | Mechanism + data-safety PROVEN (one-action re-alias; client-side data untouched) in `PRODUCTION_PATH.md`; live execution needs Vercel auth (human). |
| 13 | Two consecutive full runs, no new P0/P1 | 🟡 | One green full run captured; need a second after any change. |
| 14 | No empty cell in coverage matrix | 🔴 | Mutation column empty across all layers (see COVERAGE.md). |
| 15 | LEO-TESTS-ONLY.md = only human-ear items | ✅ | Written (`docs/LEO-TESTS-ONLY.md`); matches board's device-only RED rows. |

**Honest verdict:** the product is NOT in the shape the brief imagined (unQA'd). It is a mature,
green estate whose remaining blockers are genuinely device-only. The real, code-findable gaps are
**measurement gaps** (mutation kill-rate, always-on invariants, rollback/monitoring proof), not a
pile of undiscovered brain bugs. Priority order: #3 mutation → #5 invariants → #12/#11 prod-path.
