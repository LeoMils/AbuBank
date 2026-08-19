# Abu Engineering OS — Phase 0: Discovery & Bootstrap Plan

**Status:** DISCOVERY COMPLETE — plan proposed, nothing installed or modified (per Phase-0 scope).
**Author context:** Claude Code 2.1.190 · model Opus 4.8 [1m] · single foreground context · read-only inspection only.
**Date:** 2026-07-12 · **Branch:** `rc5/cognitive-architecture-and-acceptance`

> Evidence classes used throughout: **CODE** (source read) · **MOCK** (test double) · **BROWSER** ·
> **PREVIEW** (Vercel) · **DEVICE** (physical iPhone) · **PRODUCTION**. No claim in this document
> asserts a stronger class than was actually observed. Where I did not run a command, I say so.

---

## 0. Executive summary

This repo is **not** under-tooled — it is **over-built and under-consolidated**. Discovery found:

- **297 test files**, a `src/eval/` harness (~40 files), a `src/evolution/` state machine (~26 files),
  and **~80 markdown reports** in `docs/eval/`. This is a large, partly redundant intelligence surface.
- **11 subagents**, **~11 project skills**, **5 scoped rules**, **2 CLAUDE.md files** — a strong,
  already-mature Claude Code footprint. (Verified by directory read.)
- **Zero active hooks** (only `.claude/hooks/RECOMMENDED_HOOKS.md`, a doc — not wired).
- **Zero installed plugins / no `enabledPlugins`**, despite the official marketplace being present with
  39 plugins (incl. `typescript-lsp`, `code-review`, `playwright`, `security-guidance`).
- **No `.mcp.json`** in-repo; `mcp__Claude_Preview__preview_start` is referenced only in a permission
  allow-entry. Gmail/GCal/GDrive MCP tools are available via the account connector (deferred tools).
- **A version-of-truth conflict**: `package.json` = `30.14.0` vs `src/version.ts` = `0.63.0-…`.
  These two "single sources of truth" disagree. (CODE evidence.)
- **Duplicate runtime brains**: `conversationEngineV2`, `conversationOS`, `cognitiveRuntime` (61 KB),
  `conversationBrain`, `understandingOrchestrator`, `executiveCognitiveController`, `metaReasoner`,
  `semanticIntelligenceEngine` all coexist in `src/screens/AbuAI/`. `index.tsx` is **187 KB**.
- **A client-key exposure risk**: `.env.example` declares `VITE_OPENAI_API_KEY` (the `VITE_` prefix
  bundles the value to the browser). Server routes exist in `api/`, so the split is unclear. Needs audit.

**The Engineering OS is therefore mostly a *consolidation + gating + evidence* problem, not a build-out.**
The plan below prefers wiring existing mechanisms (agents, skills, benchmark, evolution) over new code.

**FINAL VERDICT: `READY TO BOOTSTRAP ENGINEERING OS`** — with two facts to confirm before Day 1
(see §14). None block starting; both are cheap to resolve.

---

## PHASE 0A — Environment & Claude Code inventory

### A.1 Platform (verified)
| Item | Value | Evidence |
|---|---|---|
| Claude Code version | **2.1.190** | `claude --version` |
| Install / update channel | `autoUpdatesChannel: latest` | `~/.claude/settings.json` |
| Model | Opus 4.8 (`claude-opus-4-8[1m]`) | session env |
| Node / npm | v24.13.1 / 11.8.0 | shell |
| TUI / voice / push notif | `tui: fullscreen`, `voiceEnabled: true`, `agentPushNotifEnabled: true` | `~/.claude/settings.json` |
| Permission mode / auto mode / effort | Not machine-readable from within session; governed by harness | — (report as UNVERIFIED) |
| Context usage | Not exposed as a number to the model | — (UNVERIFIED) |

### A.2 Existing Claude Code assets (verified by directory read)
| Asset | Count / location | Notes |
|---|---|---|
| CLAUDE.md | 2 — root + `.claude/CLAUDE.md` | Product rules vs process rules. Good split. |
| Scoped rules | 5 — `.claude/rules/*.md` | calendar-date-integrity, emotional-accuracy, privacy-boundaries, senior-ux (+ 1) |
| Project skills | ~11 — `.claude/skills/*/SKILL.md` | production-war-room, release-gate, verify-production, p0-fix, agent-review, add-family-member, update-knowledge, abu-* |
| Subagents | 11 — `.claude/agents/*.md` | production-commander, voice/calendar/memory/backend/mobile/observability/release/security/qa/product-ux |
| Commands | 1 — `.claude/commands/workbench.md` | legacy AI-workbench bridge |
| Hooks | **0 active** — only `RECOMMENDED_HOOKS.md` (doc) | Nothing enforced by the harness. |
| Settings (project) | `.claude/settings.local.json` = **26 KB** | Large permission allow-list; sprawl (see risks). |
| Settings (user) | `~/.claude/settings.json` (271 B) + `settings.local.json` (629 B) | minimal, clean |
| MCP servers | **No `.mcp.json`** | `Claude_Preview` referenced in a permission entry only. Account connectors (Gmail/GCal/GDrive) available as deferred tools. |
| Plugins | **none installed**, no `enabledPlugins` key | marketplace present but unused |
| Marketplaces | `claude-plugins-official` (anthropics/claude-plugins-official) | last updated 2026-06-24 |
| Routines / crons | none observed | `CronList` not run this phase |
| GitHub Actions | 2 — `ci.yml`, `android-debug-apk.yml` | CI = tsc + vitest + build on push/PR→main. **No Claude GH action.** |
| Agent SDK / headless | none in-repo | `scripts/` are node/tsx utilities, not SDK agents |
| Browser tooling | Playwright installed (`@playwright/test`), `e2e/` has 6 specs + report | BROWSER capable, not CI-wired |

### A.3 Official marketplace plugins present (39) — relevance triage for a TS/Vite/Vercel PWA
> All plugins are **currently uninstalled**. Verdicts below are recommendations for Day 1; **install nothing yet.**

| Plugin | Source | Components | Context cost | Perms/risk | Scope | Verdict |
|---|---|---|---|---|---|---|
| `typescript-lsp` | official | LSP code-intelligence | Low (on-demand) | read-only nav | project | **INSTALL** — go-to-def/refs across 187 KB files is high-ROI |
| `code-review` | official | review skill/cmd | Low | read-only | project | **INSTALL** — already exposed as `/code-review`; formalize |
| `pr-review-toolkit` | official | PR review agents | Med | read GH | project | **INSTALL** — pairs with GH action |
| `playwright` (ext) | external_plugins | browser MCP | Med (browser proc) | launches browser | project, gated | **INSTALL (gated)** — BROWSER/PREVIEW proof |
| `security-guidance` | official | security review | Low | read-only | project | **INSTALL** — cheap, matches privacy rules |
| `skill-creator` | official | skill scaffolding | Low | write `.claude/skills` | project | **INSTALL (Day 2 only)** — authoring aid |
| `hookify` | official | hook scaffolding | Low | writes settings | project | **INSTALL (Day 2 only)** — build the hooks below |
| `session-report` | official | session summary | Low | read-only | project | **CONSIDER** — observability aid |
| `frontend-design` | official | UI design agent | Med | read-only | project | **CONSIDER** — senior-UX overlaps existing rules |
| `commit-commands` | official | commit helpers | Low | git | project | **CONSIDER** — repo already has commit conventions |
| `serena` (ext) | external | semantic code MCP | Med-High | indexes repo | — | **REJECT (for now)** — overlaps `typescript-lsp`; redundant |
| `context7` (ext) | external | docs retrieval MCP | Med | network | — | **REJECT** — not needed for a fixed stack |
| `mcp-tunnels`, `mcp-server-dev`, `agent-sdk-dev`, `plugin-dev` | official | dev SDK tooling | Med | broad | — | **DEFER** — only if we build the SDK agent (Day 3) |
| `firebase`, `laravel-boost`, `terraform`, `gitlab`, `asana`, `linear`, `discord`, `telegram`, `imessage`, `fakechat`, `greptile`, `cwc-makers` | external / official | integrations | varies | broad/network | — | **REJECT** — not this stack |
| `*-lsp` (clangd, csharp, gopls, jdtls, kotlin, lua, php, pyright, ruby, rust-analyzer, swift) | official | other-language LSP | — | — | — | **REJECT** — wrong languages |
| `ralph-loop`, `math-olympiad`, `playground`, `example-plugin`, `explanatory/learning-output-style`, `code-modernization`, `code-simplifier`, `claude-code-setup`, `claude-md-management` | official | misc | Low | varies | — | **DEFER/REJECT** — `claude-md-management` worth a look Day 2 |

**Net Day-1 install set (7):** `typescript-lsp`, `code-review`, `pr-review-toolkit`, `security-guidance`,
`playwright` (gated), plus Day-2 authoring: `hookify`, `skill-creator`.

---

## PHASE 0B — Whole-repository system discovery

### B.1 Architecture graph (CODE)
```
Browser PWA (React 18 + Vite 5 + vite-plugin-pwa + Zustand)
  └─ Shell → screens/{Home, AbuAI, AbuWhatsApp, AbuCalendar, AbuGames, AbuWeather,
                      FamilyGallery, FamilyPhones, Settings, Admin, Opening, Offline, Error}
        └─ AbuAI (the product core): index.tsx (187 KB) → router.ts → { conversation engines }
Serverless API (Vercel, api/*.ts)
  ├─ abuai-chat.ts   (LLM chat proxy)
  ├─ abuai-online.ts (web/online answers)
  ├─ abuai-stt.ts    (speech-to-text)
  ├─ abuai-tts.ts    (text-to-speech)
  ├─ realtime-token.ts (OpenAI Realtime ephemeral token minting)
  └─ health.ts
Knowledge (source of truth) → generators → memory/* (generated) + knowledge/family/people/* (generated)
Native shell: Capacitor (android/, ios/) — @capacitor 8.x
```

### B.2 Runtime graph (CODE) — the AbuAI turn
`index.tsx` → `router.ts` (28 KB) → intent/domain routing → one-or-more of the overlapping engines
(`conversationOS`, `conversationEngineV2`, `cognitiveRuntime`, `understandingOrchestrator`,
`executiveCognitiveController`) → `responseShaper.ts` (22 KB) → voice delivery
(`speechDeliveryRuntimeV2`, `services/voice.ts`, `services/realtimeVoice.ts`) OR text bubble.
**Finding:** multiple engines can plausibly answer the same turn; which one is authoritative at runtime
is not obvious from names alone → **duplicate-runtime hunt required (skill `duplicate-runtime-hunter`).**

### B.3 Capability graph
Conversation · Calendar (create/mutate/reason) · Family graph/reasoning · Memory/continuity ·
Voice (STT/TTS/Realtime full-duplex) · Online/general-knowledge · WhatsApp message generation ·
Games · Weather · Family phones/gallery · Proactive/companion · Evolution (self-improvement loop).

### B.4 Data-flow graph
`knowledge/family_data.json` (SoT) → `generate:memory` / `generate:knowledge` → `memory/*` +
`knowledge/family/people/*` → runtime loaders (`familyKnowledgeLoader`, `services/familyLoader`) →
family reasoning engines. Calendar/reminders persist via `idb` (`services/durableStore`, IndexedDB).

### B.5 Provider graph (CODE)
| Capability | Provider(s) | Where | Notes |
|---|---|---|---|
| Chat | OpenAI (+ Groq llama-3.3-70b per memory) | `api/abuai-chat.ts`, AbuAI `service.ts` (81 KB) | dual provider |
| Online answers | OpenAI/web | `api/abuai-online.ts` | honesty guards present |
| STT | OpenAI whisper-class | `api/abuai-stt.ts` | Hebrew-biased language pin (recent commit) |
| TTS | OpenAI + `edge-tts` dep + Web Speech fallback | `api/abuai-tts.ts`, `services/voice.ts` | multi-tier fallback |
| Realtime voice | OpenAI Realtime (`gpt-realtime`, `/v1/realtime/client_secrets`) | `api/realtime-token.ts` | 2026 contract; device-only proof pending |
| Env declared | `VITE_OPENAI_API_KEY`, `VITE_GEMINI_API_KEY`, `VITE_GROQ_API_KEY` | `.env.example` | **`VITE_` = client-bundled → key-exposure risk to audit** |

### B.6 State-machine inventory
`src/evolution/stateMachine.ts` (self-improvement) · `services/voiceStateMachine.ts` ·
voice/latency loop guards (`latencyLoopStateGuard`) · calendar mutation reasoner. (CODE, tests exist.)

### B.7 Router/resolver inventory
`router.ts`, `knowledgeRouter`, `sourceRouter`, `realtimeCheapSourceRouter`, `contextResolver`,
`pronounResolver`, `relationalResolver`, `familyPathReasoner`, `domainRegistry`/`domainPlugin`.
**Finding:** ≥4 routers — candidate consolidation target.

### B.8 Persistence/storage inventory
IndexedDB via `idb` (`durableStore`, calendar/reminder stores) · localStorage keys
(`persistenceKeys.test.ts`) · generated `memory/*` files · `backup.ts` / `storageService.ts`.

### B.9 Test/evaluation inventory (CODE — counts verified, pass-state NOT run this phase)
- **297** `*.test.ts(x)` files under `src/`.
- `src/eval/` (~40): gauntlets, replay harnesses, judges (`conversationQualityJudge`, `judgeRunner`).
- `src/evolution/` (~26): observer→ingestion→evaluation→release self-improvement loop.
- `e2e/` (6 Playwright specs): production-simulator, voice-playback-proof, persistence, smoke, iphone repro.
- `docs/eval/` (~80 reports) — many overlapping "FINAL"/"TRUTH"/"ACCEPTANCE" docs → **doc sprawl**.
- **NOT VERIFIED this phase:** whether `npm run check` / the 297 suites currently pass. Marked UNKNOWN.

### B.10 Deployment/runtime inventory
Vercel (`vercel.json`, `.vercel/`, serverless `api/`) · Capacitor native (`android/`, `ios/`) ·
PWA (`vite-plugin-pwa`) · dev HTTPS via `scripts/dev-https.cjs`.

### B.11 Diagnostics/observability inventory
`liveTurnDiagnostics`, `voiceFlightRecorder`, `voiceDiagLog`, `productDiagnostics`, `platformHealth`,
Product Truth panel (`productTruth.ts`), `[AbuAI][VOICE|LATENCY]` tags. Good in-app; **no external
telemetry sink / SLO dashboard.**

### B.12 Privacy/security inventory
Rules exist (`privacy-boundaries.md`: no phone numbers/medical/financial/street in memory). Risks:
`VITE_OPENAI_API_KEY` client exposure (audit), real `.env` present (do not print), 26 KB permission
allow-list with broad entries (e.g. `Bash(node:*)`, `Bash(curl:*)`, `git add/commit` allowed).

### B.13 Smells & anti-patterns found (CODE-level)
| Smell | Evidence | Proposed owner skill |
|---|---|---|
| Version SoT conflict | `package.json 30.14.0` ≠ `version.ts 0.63.0` | `release-gate` |
| Duplicate runtime brains | 6+ overlapping engines in AbuAI | `duplicate-runtime-hunter` |
| Monster files | `index.tsx` 187 KB, `service.ts` 81 KB, `calendarCreate.ts` 62 KB | `dead-code-hunter` + refactor plan |
| Doc sprawl | ~80 `docs/eval` reports, many "FINAL_*" | consolidation (not code) |
| Pre-commit runs FULL vitest | `.githooks/pre-commit` runs `npm test` | slow commits; move heavy suites to CI |
| Unbounded fallback risk | multi-tier voice fallbacks | `voice-runtime-audit`, `latency-budget` |
| Tests-with-no-runtime / runtime-with-no-tests | to be measured | `system-discovery` workflow |
| Encoded-wrong-behavior tests | not yet audited | `production-reality` + `failure-to-regression` |
| Uncommitted working tree | many `M`/`??` files incl logs (`*.log`, `playwright-report/`) | `.gitignore` hygiene |

---

## PHASE 0C — Claude Code capability design (proposed; not created)

### C.1 Proposed directory layout
```
CLAUDE.md                          # keep, trim to <200 lines (currently ~150; OK)
.claude/
  CLAUDE.md                        # process rules (keep)
  rules/                           # existing 5 + add: evidence-classes.md, provider-contract.md
  skills/                          # existing + the 20 OS skills below (SKILL.md each)
  agents/                          # existing 11 (reuse; do NOT duplicate)
  hooks/
    settings.snippet.json          # the hooks to paste into settings (from RECOMMENDED_HOOKS)
    guards/*.cjs                   # small node guard scripts (version-sync, evidence-claim, secret-edit)
  settings.json                    # NEW project settings (hooks + enabledPlugins + tidy permissions)
  workflows/                       # 4 controlled workflows (0D)
tools/
  abu-engineering-agent/           # Agent SDK / headless runner (Day 3)
docs/
  engineering-os/                  # this doc + generated reports + ACCEPTANCE_BOARD.md
evaluation/                        # replay store + benchmark manifests (may reuse src/eval)
  gold/                            # gold replay conversations (redacted)
.github/workflows/                 # ci.yml (keep) + abu-review.yml (Claude action, Day 3)
```

### C.2 The 20 required skills — specs (trigger · inputs · process · tools · output · done · forbidden · context)

> All read-first skills run in the **current context**; heavy fan-out skills run in **isolated context**
> (subagent) to protect the main window. Output schema is JSON unless noted.

1. **system-discovery** — *Trigger:* start of any recovery cycle / "map the system". *In:* repo. *Process:* build B.1–B.13 graphs, diff code-vs-runtime-vs-tests. *Tools:* Glob/Grep/Read. *Out:* `{graphs, orphans[], duplicates[], untested_paths[]}`. *Done:* every capability mapped to ≥1 runtime file + test. *Forbidden:* editing code. *Context:* isolated.
2. **grill-me** — *Trigger:* before accepting any "done/works". *In:* a claim + its evidence. *Process:* adversarially interrogate the claim, demand the command that proves it. *Tools:* Read/Bash(run tests). *Out:* `{claim, evidence_class, verdict}`. *Done:* verdict ∈ {PROVEN, NOT_PROVEN}. *Forbidden:* accepting grep as HIGH. *Context:* current.
3. **production-reality** — *Trigger:* any PASS claim. *In:* test/report. *Process:* classify CODE/MOCK/BROWSER/PREVIEW/DEVICE/PRODUCTION; flag over-claims. *Out:* evidence-class ledger. *Done:* every claim tagged. *Forbidden:* upgrading a class. *Context:* current.
4. **gold-replay** — *Trigger:* nightly/weekly + pre-release. *In:* `evaluation/gold/*`. *Process:* replay real conversations through runtime, diff vs gold. *Tools:* vitest/tsx. *Out:* pass%, regressions[]. *Done:* replay ran (not mocked). *Forbidden:* editing gold to pass. *Context:* isolated.
5. **failure-to-regression** — *Trigger:* any new bug/incident. *In:* failing transcript. *Process:* convert to a deterministic failing test first, then hand to fix. *Out:* new `*.test.ts` (red). *Done:* test reproduces the failure. *Forbidden:* fixing before the red test exists. *Context:* current.
6. **voice-runtime-audit** — *Trigger:* voice change. *In:* voice pipeline. *Process:* trace STT→LLM→TTS/Realtime, check fallbacks bounded, no silent waits. *Out:* pipeline report + evidence class (CODE vs DEVICE). *Done:* every fallback has a bound + a truthful UI state. *Forbidden:* claiming DEVICE without device. *Context:* isolated.
7. **online-truth-audit** — *Trigger:* online/general-knowledge change. *Process:* verify "no tool result = no claim"; assert honesty guards. *Out:* honesty ledger. *Done:* no fabricated tool-use paths. *Forbidden:* — . *Context:* current.
8. **calendar-integrity** — *Trigger:* calendar/date change. *Process:* enforce `.claude/rules/calendar-date-integrity.md` (no invented dates, YYYY-MM-DD resolution, memorial date from data). *Out:* violations[]. *Done:* transactional tests pass. *Context:* current.
9. **memory-integrity** — *Trigger:* memory/knowledge change. *Process:* assert `memory/*` regenerated from `knowledge/*`, never hand-edited. *Tools:* `generate:memory`, `validate:knowledge`. *Out:* drift report. *Done:* generated files match source. *Forbidden:* editing `memory/*` directly. *Context:* current.
10. **family-graph-audit** — *Trigger:* family data change. *Tools:* `validate:family`. *Out:* graph consistency (aliases, relations, genders). *Done:* validator green. *Context:* current.
11. **conversation-quality** — *Trigger:* tone/response change. *Process:* run `conversationQualityJudge` on a sample; score warmth/non-patronizing/Hebrew-Spanish. *Out:* score + failing moments. *Done:* judge ran on real outputs. *Context:* isolated.
12. **latency-budget** — *Trigger:* runtime path change. *Process:* measure/estimate turn latency vs SLO; flag unbounded retries. *Out:* latency ledger. *Done:* budget stated per stage. *Context:* current.
13. **provider-contract** — *Trigger:* provider/api change. *Process:* verify request/response contract vs live provider docs (OpenAI Realtime/STT/TTS/chat). *Out:* contract diffs, stale-contract flags. *Done:* contract matches current API. *Forbidden:* assuming from memory. *Context:* current.
14. **dead-code-hunter** — *Trigger:* consolidation. *Process:* find exports with no reachable call site (runtime or test). *Out:* dead-symbol list. *Done:* each flagged symbol has a verdict. *Forbidden:* deleting without human OK. *Context:* isolated.
15. **duplicate-runtime-hunter** — *Trigger:* consolidation. *Process:* cluster the overlapping engines/routers; identify the ONE authoritative path per capability. *Out:* keep/retire matrix. *Done:* authoritative path named per capability. *Context:* isolated.
16. **release-gate** — *Trigger:* pre-merge/pre-deploy. *Tools:* `npm run check`, `npm run build`, benchmark. *Process:* refuse without passing commands + version sync. *Out:* GATE=PASS/FAIL + evidence. *Done:* all gates green + versions reconciled. *Forbidden:* optimism without command output. *Context:* current.
17. **preview-verification** — *Trigger:* pre-merge. *Tools:* Vercel Preview + Playwright/Preview MCP. *Out:* PREVIEW-class proof (screenshot/DOM). *Done:* real preview URL exercised. *Forbidden:* calling PREVIEW what is only CODE. *Context:* isolated.
18. **privacy-audit** — *Trigger:* memory/log/api change. *Process:* enforce `privacy-boundaries.md`; scan for phone/medical/financial/street in memory + client key exposure. *Out:* PII/secret findings. *Done:* no violations. *Context:* current.
19. **incident-report** — *Trigger:* production/device failure. *Process:* structured post-mortem → links to a new regression test. *Out:* `docs/engineering-os/incidents/*.md`. *Done:* incident has a red test. *Context:* current.
20. **external-review-pack** — *Trigger:* before external/human review. *Process:* bundle diff + evidence ledger + gate results into one pack. *Out:* review pack md. *Done:* pack self-contained. *Context:* current.

---

## PHASE 0D — Controlled orchestration design (4 workflows; NOT executed)

Shared constraints for all four: **3–5 research agents max · read-only research first · no parallel
edits to the same files · only the primary orchestrator may edit/commit/push/deploy · no hidden
worktrees · no production deploy · explicit token+time budget · explicit stop conditions · agents must
try to falsify their own findings · a `TaskCompleted`/evidence gate requires a passing command, not prose.**

1. **system-discovery** — 4 read-only agents (architecture, runtime-vs-test, providers, privacy/security)
   → orchestrator synthesizes B-graphs + orphan/duplicate lists. Budget ~120 K tok / 15 min.
   *Stop:* any agent needs to write. *Evidence:* graphs cite file:line.
2. **competing-root-causes** — for one failing benchmark moment, 3 agents each argue a *different* root
   cause and must refute the other two; orchestrator picks the survivor. Budget ~80 K / 10 min.
   *Stop:* no falsifiable hypothesis. *Evidence:* a red repro test.
3. **review-council** — reuse existing agents (qa-failure, security-privacy, product-ux, release-manager)
   as read-only reviewers of the current diff; adversarial. Budget ~100 K / 12 min.
   *Stop:* diff touches `package.json`/`.env*`/`memory/*` → HUMAN_APPROVAL_REQUIRED. *Evidence:* per-agent verdict.
4. **intelligence-benchmark** — run smoke→nightly tiers, cluster regressions, judge quality; report only.
   Budget scales to tier. *Stop:* provider live-call needed without key/opt-in. *Evidence:* real run output, class-tagged.

> These are **designs**. Phase 0 does not run them and does not create the `.claude/workflows/` files.

---

## PHASE 0E — Test & intelligence strategy (design)

| # | Layer | What | Evidence class it can legitimately claim |
|---|---|---|---|
| 1 | **100-q smoke** | fast deterministic benchmark (extend `benchmarkConversations.ts`) | CODE |
| 2 | **500-q nightly** | broader corpus (reuse `src/eval` gauntlets) | CODE (+ MOCK where mocked) |
| 3 | **5,000-q weekly** | full replay + gauntlet sweep | CODE |
| 4 | **Gold replay** | `evaluation/gold/` from real (redacted) transcripts | CODE (replayed), not DEVICE |
| 5 | **He/Es matrix** | language matrix across intents | CODE |
| 6 | **Voice sim matrix** | STT/TTS/Realtime paths with recorded audio | CODE/MOCK — **never DEVICE** without a phone |
| 7 | **Live Preview provider tests** | real Vercel preview + real provider calls | PREVIEW/PRODUCTION — gated, opt-in, keyed |
| 8 | **Calendar transactional** | create/mutate/persist round-trips (IndexedDB) | CODE/BROWSER |
| 9 | **Memory + family graph** | generation + validation + reasoning | CODE |
| 10 | **Natural-conversation judge** | `conversationQualityJudge` on real outputs | CODE (judge is a model → label as such) |
| 11 | **Latency/SLO** | per-stage budgets, unbounded-retry flags | CODE (BROWSER/DEVICE for real timing) |
| 12 | **Regression clustering** | group failures by taxonomy (`evolution/failureTaxonomy`) | CODE |
| 13 | **Production Acceptance Board** | one artifact rolling up all above **with class tags** | mixed — each row tagged |

**Hard rule (enforced by `production-reality` skill + a hook):** a suite that runs on mocks may **not**
be reported as BROWSER/PREVIEW/DEVICE/PRODUCTION. The Acceptance Board must show the *lowest* honest class.

---

## PHASE 0F — Exact installation & implementation plan (5 days)

> Every step: command · files · order · risk · rollback · duration · ~context cost · deps · verification.
> Nothing here is executed in Phase 0.

### Day 1 — Platform & plugins (~1–2 h, low risk)
| # | Action | Command / file | Risk | Rollback | Verify |
|---|---|---|---|---|---|
| 1.1 | Snapshot current config | `git switch -c chore/eng-os-bootstrap` | none | delete branch | branch created |
| 1.2 | Install LSP | `/plugin install typescript-lsp@claude-plugins-official` | low | `/plugin uninstall` | go-to-def works on `router.ts` |
| 1.3 | Install review plugins | install `code-review`, `pr-review-toolkit`, `security-guidance` | low | uninstall | `/code-review` runs |
| 1.4 | Install browser (gated) | install `playwright` (external) | med (browser proc) | uninstall | launches, hits localhost |
| 1.5 | Record `enabledPlugins` | new `.claude/settings.json` | low | git revert | plugins persist on reload |
*Deps:* none. *Context:* low (LSP loads on demand).

### Day 2 — CLAUDE.md, rules, skills, hooks, agents (~3–4 h, low-med risk)
| # | Action | Files | Risk | Rollback | Verify |
|---|---|---|---|---|---|
| 2.1 | Trim/confirm root `CLAUDE.md` <200 lines | `CLAUDE.md` | low | git | line count |
| 2.2 | Add 2 rules | `.claude/rules/evidence-classes.md`, `provider-contract.md` | low | git | files load |
| 2.3 | Author the 20 skills (use `skill-creator`) | `.claude/skills/*/SKILL.md` | low | git | `/` lists them |
| 2.4 | Wire hooks (use `hookify`) | `.claude/settings.json` + `.claude/hooks/guards/*.cjs`: (a) secret-edit warn, (b) version-sync check (`package.json` vs `version.ts`), (c) evidence-claim gate, (d) post-edit `npm run check` reminder | **med** (hooks affect every tool call) | remove hook block | trigger each hook once |
| 2.5 | Reuse existing 11 agents (do **not** duplicate) | — | low | — | agents unchanged |
*Deps:* Day 1. *Context:* med. *Stop condition:* hook 2.4b will surface the version conflict — resolve which is SoT before enabling gates.

### Day 3 — Agent SDK, CI, browser/Preview (~4–6 h, med risk)
| # | Action | Files | Risk | Rollback | Verify |
|---|---|---|---|---|---|
| 3.1 | Headless runner | `tools/abu-engineering-agent/` (Agent SDK) | med | delete dir | runs `system-discovery` headless |
| 3.2 | Claude GH action | `.github/workflows/abu-review.yml` (read-only PR review) | med (CI perms/secrets) | delete workflow | dry-run on a test PR |
| 3.3 | Preview verification path | `preview-verification` skill + Playwright→Vercel preview | med | disable | screenshot from real preview |
| 3.4 | Move heavy suites out of pre-commit | `.githooks/pre-commit` → validate:family + typecheck only; full vitest → CI | low | restore hook | commit is fast; CI still runs all |
*Deps:* Day 1–2. *Stop:* 3.2 needs a GH secret (`ANTHROPIC_API_KEY`) — **HUMAN_APPROVAL_REQUIRED**.

### Day 4 — Replay/eval + Acceptance Board (~4–6 h, low-med risk)
| # | Action | Files | Risk | Rollback | Verify |
|---|---|---|---|---|---|
| 4.1 | Gold store (redacted) | `evaluation/gold/*` (via `evolution/redaction`) | med (PII) — privacy-audit first | delete | replay runs |
| 4.2 | Benchmark tiers manifest | `evaluation/{smoke,nightly,weekly}.json` mapping to existing suites | low | delete | each tier runs |
| 4.3 | Acceptance Board artifact | `docs/engineering-os/ACCEPTANCE_BOARD.md` (class-tagged rows) | low | delete | board renders from a real run |
*Deps:* Day 2 skills. *Stop:* 4.1 must pass `privacy-audit` before any real transcript is stored.

### Day 5 — First full discovery + recovery program (~1 day, read-only)
| # | Action | Output | Verify |
|---|---|---|---|
| 5.1 | Run `system-discovery` workflow | B-graphs + orphan/duplicate/untested lists (evidence-cited) | file:line citations |
| 5.2 | Run `intelligence-benchmark` smoke+nightly | BENCHMARK_SCORE + regression clusters | real run output |
| 5.3 | Produce **AbuAI Recovery Program** | prioritized P0/P1 list by user-ROI | each item has a red test or a gate |

---

## FINAL OUTPUT

### 1. Current utilization score per Claude Code capability (0–10, evidence-based)
| Capability | Now | Target | Basis |
|---|---|---|---|
| CLAUDE.md | 8 | 9 | 2 well-split files exist |
| Scoped rules | 7 | 9 | 5 good rules; add evidence + provider |
| Skills | 6 | 9 | ~11 exist; 20 OS skills to add |
| Subagents | 7 | 8 | 11 exist; reuse, don't duplicate |
| Dynamic workflows | 1 | 7 | none defined; 4 designed |
| Hooks | 1 | 8 | 0 active (only a doc) |
| Settings hygiene | 3 | 8 | 26 KB permission sprawl |
| Plugins/marketplace | 1 | 7 | marketplace present, 0 installed |
| Code intelligence/LSP | 0 | 8 | no LSP; 187 KB files need it |
| MCP | 2 | 6 | connectors only; no `.mcp.json` |
| Browser/Preview validation | 4 | 8 | Playwright exists, not gated/CI-wired |
| Agent SDK / headless | 0 | 6 | none |
| GitHub Actions | 5 | 8 | CI good; no Claude action |
| Routines/remote | 2 | 5 | unused |
| Artifacts | 3 | 7 | reports exist as raw md, not artifacts |
| Replay/eval infra | 7 | 9 | large but redundant; consolidate |
| Observability/release gates | 4 | 8 | in-app diag good; no external SLO/gate |
| **Weighted overall** | **≈3.6/10** | **≈7.7/10** | — |

### 2. Target utilization score
**≈7.7 / 10** after the 5-day plan — deliberately not 10 (routines/MCP/remote stay intentionally low
for an 80+ single-user PWA; over-tooling is itself a risk here).

### 3. Exact prioritized installation list
1. `typescript-lsp` · 2. `code-review` · 3. `pr-review-toolkit` · 4. `security-guidance` ·
5. `playwright` (gated) · 6. `hookify` (Day 2) · 7. `skill-creator` (Day 2).
**Reject/defer:** all other-language LSPs, `serena`, `context7`, and every non-stack integration plugin.

### 4. Exact directory/file plan
See **§C.1**. New: `.claude/settings.json`, `.claude/hooks/guards/*.cjs`, 20 `.claude/skills/*`,
`.claude/workflows/*` (4), `tools/abu-engineering-agent/`, `.github/workflows/abu-review.yml`,
`evaluation/{gold,smoke,nightly,weekly}`, `docs/engineering-os/ACCEPTANCE_BOARD.md`.

### 5. Exact 5-day sequence
See **§0F**. Day1 plugins → Day2 rules/skills/hooks → Day3 SDK/CI/preview → Day4 replay/board → Day5 first discovery + recovery program.

### 6. Top 20 highest-impact improvements
1. Resolve version SoT conflict (`package.json` vs `version.ts`) + add version-sync hook.
2. Install `typescript-lsp` — navigation across 187 KB files.
3. Wire the evidence-class rule + `production-reality` skill (stop over-claims at the source).
4. `duplicate-runtime-hunter` → name ONE authoritative engine per capability.
5. Enable release-gate hook (no "done" without `npm run check` + `build`).
6. Move full vitest out of pre-commit into CI (fast commits, same coverage).
7. Consolidate ~80 `docs/eval` reports into one class-tagged Acceptance Board.
8. Audit `VITE_OPENAI_API_KEY` client exposure (privacy-audit skill).
9. `system-discovery` workflow → code-vs-runtime-vs-test orphan map.
10. Gold replay store from real redacted transcripts.
11. Claude GH review action on PRs.
12. Playwright→Vercel Preview as the only source of PREVIEW-class proof.
13. `provider-contract` skill pinned to live OpenAI Realtime/STT/TTS contracts.
14. Latency-budget skill → flag unbounded voice fallbacks/retries.
15. Tidy the 26 KB permission allow-list into a curated, reviewable set.
16. `.gitignore` the tracked logs/`playwright-report/` noise polluting the working tree.
17. `failure-to-regression` discipline: every incident → red test first.
18. Refactor-plan (not blind delete) for `index.tsx`/`service.ts` monsters.
19. Reuse the 11 existing agents in `review-council` instead of new agents.
20. Single BENCHMARK_SCORE as the north-star number surfaced on the Acceptance Board.

### 7. Top 20 risks / misuses to avoid
1. Installing all 39 plugins → context bloat. 2. Duplicating the 11 agents into new ones.
3. Enabling hooks that block every tool call (over-eager `PreToolUse`). 4. Editing `memory/*` directly
(it is generated). 5. Deleting "dead" code without a reachability proof. 6. Claiming DEVICE/PRODUCTION
from CODE/MOCK runs. 7. Storing real transcripts without redaction (PII). 8. Printing `.env` secrets.
9. Auto-commit/push/merge to `main`. 10. Running the 5,000-q weekly on every change (cost). 11. Live
provider calls in CI without opt-in/keys. 12. `serena`+`typescript-lsp` both indexing (redundant).
13. Broad `Bash(node:*)`/`curl:*` allows enabling unintended actions. 14. Hidden worktrees/background
agents in a "single foreground" phase. 15. Weakening a test to make a gate green. 16. Treating the
model-based judge as ground truth. 17. Mass-localizing Hebrew UI (most is by design). 18. Letting the
Acceptance Board show the *highest* not the *lowest* honest evidence class. 19. GH action secret leakage.
20. Adding skills/agents that don't move BENCHMARK_SCORE (violates NORTH_STAR guardrail).

### 8. One recommended next command
```
/plugin install typescript-lsp@claude-plugins-official
```
*(Day-1, step 1.2 — lowest risk, immediately useful across the 187 KB AbuAI files, trivially reversible.)*

---

## FINAL VERDICT

**`READY TO BOOTSTRAP ENGINEERING OS`**

Two facts to confirm before Day-1 gating (neither blocks starting):
- **Version source of truth:** is `package.json 30.14.0` or `src/version.ts 0.63.0` authoritative? The
  version-sync hook needs one answer.
- **Client key exposure:** confirm whether `VITE_OPENAI_API_KEY` is actually shipped to the browser or
  only used server-side in `api/*`; `privacy-audit` resolves this on Day 2.

Nothing was installed, deployed, or modified in Phase 0 beyond creating this document.
