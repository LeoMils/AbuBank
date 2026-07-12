# Foundation Release 1 — Report

**Scope:** minimal Engineering-OS control layer. **No AbuAI product behavior was changed.**
**Branch:** `rc5/cognitive-architecture-and-acceptance` · **Build:** `0.63.0-realtime-audio-timeout`
**Evidence classes:** `CODE < MOCK < BROWSER < PREVIEW < PHYSICAL_DEVICE < PRODUCTION`. Nothing below
is claimed at a stronger class than was actually run. Live-reload-dependent items are marked UNVERIFIED.

---

## 1. Phase-0 claims revalidation
| Phase-0 claim | Verdict | Evidence |
|---|---|---|
| Two CLAUDE.md files | CONFIRMED | `CLAUDE.md` (82→~113 lines) + `.claude/CLAUDE.md` |
| Existing rules (5) | CONFIRMED | `.claude/rules/*` (calendar-date-integrity, emotional-accuracy, privacy-boundaries, senior-ux) |
| Existing skills (~11) | CONFIRMED | `.claude/skills/*` incl. release-gate, verify-production, p0-fix |
| Existing subagents (11) | CONFIRMED | `.claude/agents/*.md` |
| No active hooks | CONFIRMED (now fixed) | only `RECOMMENDED_HOOKS.md` existed; FR1 adds real hooks |
| No installed plugins / no `enabledPlugins` | CONFIRMED (now fixed) | FR1 adds `enabledPlugins` |
| No `.mcp.json` | CONFIRMED | none in repo (out of scope for FR1) |
| Duplicate runtime systems | CONFIRMED | ≥6 overlapping engines in `src/screens/AbuAI/` (not consolidated — out of scope) |
| **Version-source "conflict"** | **CHANGED / INCORRECT as stated** | A documented contract already existed in `src/version.test.ts` (version.ts = product-build, package.json = npm semver; health.ts kept in sync by a test). The real defect was narrower: the drift guard hardcoded stale `"30.10.0"` while package.json is `30.14.0`. **Fixed** (now reads package.json dynamically). |
| **`VITE_OPENAI_API_KEY` exposure risk** | **CHANGED / INCORRECT as stated** | Client source is already guarded (`clientProviderKeyContract.test.ts` + `serverProxyContract.test.ts`); `.env` is gitignored and **never tracked / not in history**. Residual gap was only a misleading `.env.example` + no build-env guard. **Hardened**, no rotation needed. |
| Full-suite pre-commit | CONFIRMED (now fixed) | `.githooks/pre-commit` ran `npm test`; FR1 replaces with a fast guard |
| eval/evolution sprawl | CONFIRMED | 297 test files, ~40 `src/eval`, ~26 `src/evolution`, ~80 `docs/eval` reports |

## 2. Version-truth decision
**Two intentional lanes, not a conflict.** `src/version.ts` `APP_VERSION.version` is the ONE
authoritative product-build version (all UI + `/api/health` + startup log). `package.json` is the
npm/tooling semver and must never appear in UI. `api/health.ts` `BUILD_VERSION` is kept equal to
`APP_VERSION.version` by a test. Documented in `docs/engineering-os/VERSION_CONTRACT.md`. Drift guard
hardened to read the npm semver **dynamically** from `package.json` (was a stale literal). Evidence:
`src/version.test.ts` — **22/22 pass** (CODE).

## 3. OpenAI-key exposure verdict
**NOT client-exposed.** No client source reads billable `VITE_OPENAI_API_KEY`/`VITE_AZURE*`
(test-enforced). **`.env` is gitignored and never appears in git history → NO ROTATION REQUIRED.**
Residual risk closed by: (a) `.env.example` rewritten to mark `OPENAI_API_KEY` server-only and
`VITE_OPENAI_API_KEY` dev-only/never-in-build; (b) new build-env guard
`scripts/check-client-secret-leak.cjs` (clean→exit 0, simulated leak→exit 1, both proven).
Stale docs (`docs/production/VERCEL_ENV_VARS.md`, `RELEASE_BOARD.md`) still contradict the contract —
flagged for a later doc-only reconciliation (not touched here).

## 4. Plugin — installed or blocker
`typescript-lsp` verified **official** (first-party marketplace entry, source `./plugins/typescript-lsp`,
category development). **Enabled at project scope** in `.claude/settings.json`
(`"typescript-lsp@claude-plugins-official": true`). **Live LSP is UNVERIFIED in this session** — it
requires (a) the global server `npm i -g typescript-language-server typescript` (currently NOT installed;
a local `node_modules/.bin/tsserver` exists but the plugin uses the global server) and (b) a Claude Code
**session reload** to load the plugin. I did not install globally or reload, so symbol/reference/
diagnostics lookups are not proven. Reversible: remove the `enabledPlugins` entry (+ `npm un -g …`).
The other six proposed plugins were intentionally NOT installed (per scope).

## 5. CLAUDE.md / rules changes
- Root `CLAUDE.md`: appended **"Engineering OS — Always-On Truths"** (~31 lines; file ≈113 lines, well
  under 200): evidence classes, mechanism-first/first-divergence, one-runtime-path, current-info-requires-
  retrieval, calendar write=readable, residence≠live-location, typed=voice controller parity, Ofir female,
  git/deploy safety, sequential build/test.
- Added **9 path-scoped rules**: `.claude/rules/{voice,online,calendar,memory,family,privacy,testing,
  deployment,evolution}.md`. Each carries a `globs` frontmatter hint **and** an in-body "Applies to" line
  (so scope is communicated even if the harness ignores frontmatter globs — I could not verify frontmatter
  path-scoping support in this version, so I did not rely on it). They point to existing authorities
  (calendar-date-integrity, privacy-boundaries, ENV_CONTRACT) rather than duplicating facts.

## 6. Eight skills created and verified
7 new skills authored with a uniform 11-section format; `release-gate` **pre-existed and was reused**
(not recreated). Structural validator `scripts/validate-engineering-skills.cjs` → **PASS** (7 new complete
with all 11 mandatory sections + 1 reused present). All 7 new skills are registered (visible in the skill
list). CODE evidence.
- system-discovery · grill-me · production-reality · gold-replay · failure-to-regression ·
  preview-verification · incident-report  (+ reused: release-gate)

## 7. Hooks activated and tested
Wired in `.claude/settings.json`; guard scripts in `.claude/hooks/guards/` (fail-safe, `ABU_HOOKS_DISABLE=1`
kill-switch, 10s timeouts, documented in `guards/README.md`). Dry-run verified (CODE):
- **SessionStart** `session-start.cjs` → prints branch/build/P0/board link (verified output).
- **PreToolUse:Bash** `pretooluse-safety.cjs` → blocks (exit 2) `git add -A/--all/.`, force-push,
  `git reset --hard`, `git clean -f`, `vercel --prod`, staging `.env`/`*.local.json`/`*.private.json`/
  `private/`, and `cat/type .env` (allows `.env.example`). **11/11 dry-run scenarios correct**, including
  DISABLE kill-switch and allow-cases (`git status`, explicit `git add <file>`, `npm run build`).
- **PostToolUse:Edit|Write** `post-edit-light.cjs` → non-blocking advisory (sk- tokens / client
  VITE_OPENAI read / phone numbers).
- **Stop** `claim-check.cjs` → advisory-only (never blocks); reminds on success words lacking an evidence
  marker. Hard enforcement deliberately deferred to avoid false-positive blocking.
- Fixed a real bug found while testing: `_lib.cjs` now strips a UTF-8 BOM before `JSON.parse`.
- **Live activation requires a session reload** (settings hooks load at session start) → the *scripts* are
  proven; live in-session enforcement is UNVERIFIED this session.

## 8. Acceptance Board status
`docs/engineering-os/PRODUCTION_ACCEPTANCE_BOARD.md` created and populated **honestly / pessimistically**:
Voice/Online/Calendar/Follow-up/Correction/Grounding/NaturalConversation/Latency = **🔴** (failed physical
acceptance); STT 🔴; TTS/PersistentMemory/FamilyGraph/Mobile-PWA/Diagnostics = **🟡**; Privacy = **🟢 (CODE)**.
Each row records per-class evidence, first divergence, blocker, and next acceptance action. No row was made
green by this task.

## 9. Shared evidence schema
`src/engineering-os/evidence.ts` — one `EngineeringEvidence` record (capability, scenario, evidenceClass,
environment, expected, actual, verdict, firstDivergence, runtimePath, provider/tool, latency, commit,
version, traceId, regressionIds, unprovenLimits, timestamp) + `validateEvidence()` enforcing "never claim a
class stronger than the environment proves" and "Voice not PROVEN below PHYSICAL_DEVICE". It **links to**
(does not duplicate) the existing `AbuTraceEnvelope` (evolution) and `EvidencePacket` (AbuAI). Co-located
test `evidence.test.ts` → **8/8 pass** (CODE). Not imported by any product runtime path (grep-verified).

## 10. Pre-commit / test execution changes
`.githooks/pre-commit` now delegates to `scripts/precommit-guard.cjs` (fast: staged inventory + fail-closed
secret/privacy scan + version-contract consistency + family validation only when family data staged). Full
suite moved to the CI/release gate. Strategy + exact strict command (single-worker, raw-log, failure
classification CODE_ASSERTION/CONFIGURATION/ENVIRONMENT_OOM/TOOLING/EXTERNAL_SERVICE) documented in
`docs/engineering-os/RELEASE_TEST_STRATEGY.md`. Guard runs clean (exit 0) on the current staged set.

## 11. Self-test results (Phase 10)
| # | Scenario | Result | Class |
|---|---|---|---|
| 1 | `git add -A` blocked | ✅ exit 2 | CODE |
| 2 | Prod deploy (`vercel --prod`) blocked | ✅ exit 2 | CODE |
| 3 | Stage `*.private.json` / `*.local.json` blocked | ✅ exit 2 | CODE |
| 4 | grill-me on unsupported claim | ✅ demonstrated below | CODE |
| 5 | system-discovery makes no premature edits | ✅ skill is read-only by spec (no Edit/Write in Tools) | CODE |
| 6 | gold-replay produces a valid artifact shape | ✅ schema present; artifact shape defined | CODE |
| 7 | release-gate blocks incomplete release | ✅ pre-existing skill defaults to HOLD without evidence | CODE |
| 8 | preview-verification classifies as PREVIEW | ✅ skill fixes evidenceClass=PREVIEW, forbids "Production" | CODE |
| 9 | TS code intelligence | ⚠️ enabled in config; live LSP UNVERIFIED (needs global server + reload) | — |
| 10 | CLAUDE.md + rules load | ✅ skills registered in list; rules are valid markdown (path-scoping frontmatter unverified) | CODE/partial |
| 11 | Hooks can be disabled | ✅ `ABU_HOOKS_DISABLE=1` → all guards exit 0 | CODE |
| 12 | No product behavior changed | ✅ grep: no product file imports `engineering-os`; only new files + test/config/doc edits | CODE |

**grill-me demonstration (#4).** Claim: *"Voice is fixed — the realtime watchdog resolves it."*
→ evidenceClass offered: CODE (watchdog logic + tests). Required for a voice "fixed" claim:
PHYSICAL_DEVICE (audible warmth + on-device latency). No device artifact exists. **Verdict:
UNSUPPORTED_CLAIM** — the watchdog is proven at CODE only; device audibility is unproven (P0-DEVICE).

## 12. Files changed
**Modified (4):** `CLAUDE.md`, `.env.example`, `.githooks/pre-commit`, `src/version.test.ts`.
**New:** `.claude/settings.json`; `.claude/rules/{voice,online,calendar,memory,family,privacy,testing,
deployment,evolution}.md` (9); `.claude/skills/{system-discovery,grill-me,production-reality,gold-replay,
failure-to-regression,preview-verification,incident-report}/SKILL.md` (7); `.claude/hooks/guards/{_lib,
pretooluse-safety,session-start,post-edit-light,claim-check}.cjs` + `README.md` (6); `scripts/{check-client-
secret-leak,validate-engineering-skills,precommit-guard}.cjs` (3); `src/engineering-os/{evidence.ts,
evidence.test.ts}` (2); `docs/engineering-os/{VERSION_CONTRACT,PRODUCTION_ACCEPTANCE_BOARD,
RELEASE_TEST_STRATEGY,FOUNDATION_RELEASE_1_REPORT}.md` (+ pre-existing `PHASE_0_…` doc).
**Deliberately NOT staged:** all pre-existing product edits, `memory/*`, `knowledge/*`, logs,
`playwright-report/`, `.claude/settings.local.json`, unrelated working-tree changes.

## 13. Tests / gates
- `npx tsc --noEmit` → **exit 0** (caught + fixed one strict-mode issue in evidence.ts).
- `npx vitest run src/version.test.ts src/engineering-os/evidence.test.ts` → **30/30 pass**.
- `node scripts/validate-engineering-skills.cjs` → **PASS** (7 new + 1 reused).
- `node scripts/check-client-secret-leak.cjs` → clean exit 0; simulated leak exit 1.
- Hook guard dry-runs → **11/11 pretooluse scenarios correct**; session-start prints; pre-commit clean.
- Full 297-file suite: **NOT run** (not required for isolated config/doc/test additions; it is the CI/
  release gate). This is stated honestly, not claimed as green.

## 14. Commit SHA
See below (filled after commit) — `chore(engineering-os): bootstrap evidence-driven foundation`.

## 15. Branch
`rc5/cognitive-architecture-and-acceptance` (not merged to main; not deployed).

## 16. Product behavior unchanged — explicit confirmation
**Confirmed.** No file under a product runtime path was modified. The only `src/` changes are: a new
isolated module `src/engineering-os/` (imported by nothing but its own test — grep-verified) and a
test-only hardening in `src/version.test.ts`. `tsc` is clean. No AbuAI engine, screen, service, or API
route was touched.

## 17. Remaining Engineering-OS work (deferred)
MCP config; the other 12 skills; 4 dynamic workflows; Agent SDK headless runner; Claude GH review action;
the 6 remaining plugins; runtime-brain consolidation + 187 KB `index.tsx` refactor; external SLO/telemetry;
doc-sprawl reconciliation (incl. stale VERCEL_ENV_VARS/RELEASE_BOARD); 500/5,000-q benchmarks; live LSP
verification after reload.

## 18. Exact Production Recovery plan (what runs after this foundation)
1. **Reload** the session so plugins + hooks are live; run `system-discovery` on AbuAI to name the ONE
   authoritative runtime path per capability (kills the duplicate-brain ambiguity).
2. For each **🔴** board row, capture the real device transcript → `failure-to-regression` (red test at the
   first divergence) → `gold-replay` (durable artifact). Order by user-ROI: **Latency → Online → Calendar
   → Follow-up/Correction → Grounding → Natural Conversation → Voice(device)**.
3. Fix ONE capability at a time (smallest safe change; bump `APP_VERSION` + `api/health.ts` together),
   re-run the capability-targeted tests + the new red tests, and update the Acceptance Board via
   `production-reality` (weakest honest class only).
4. Before any release: `release-gate` + `preview-verification` (PREVIEW class) + explicit device limits.
5. Physical device retest for Voice/STT/TTS (the only PHYSICAL_DEVICE evidence source) — owner: Leo.
6. Never deploy to Production without explicit approval; never merge to main autonomously.

---

## Final verdict
**FOUNDATION RELEASE 1 READY.**

## One recommended next action
Run the AbuAI Production Recovery Master workflow.
