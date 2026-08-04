# Production Convergence — Worklog

## Session 2026-08-04 (build 0.172.0 → 0.173.0)

### Reality restored from evidence (not narrative)
- Branch `rc5/cognitive-architecture-and-acceptance`, HEAD `1c9e750` at start.
- Version contract in sync at 0.172.0 (`src/version.ts` == `api/health.ts`).
- Certified ADR-0001 present; realtime control plane / kernel / truth monitor / function bridge all exist and are tested.
- **Baseline gates (real commands):** `tsc --noEmit` exit 0; `vitest run` → 422 files, **11938 passed / 2 todo**; realtime slice **81 passed**.

### Defect found + fixed (automatable, mechanism-first)
Audited the live realtime path per mission §0 ("truth-monitor false positives in normal forward Hebrew"). Found **two real over-block defects** with **no test protecting the buggy behavior**:
1. `TM-FP-001` (High) — the `כבר…` completion group carried 2nd-person `שלחת` ("YOU sent"); an assistant question `כבר שלחת לו?` was flagged as a fabricated 1st-person completion → nonsensical self-repair.
2. `TM-FP-002` (Medium) — `דיברתי עם` lacked the `לא ` negation guard every other completion verb had; `לא דיברתי עם מור` over-blocked.

Process: **red test first** (2 failing, confirmed the defect) → minimal fix in `truthMonitor.ts` (negation guard on both; dropped 2nd-person `שלחת`) → green (23/23) → live-path suite still green → version bump 0.173.0 → contract synced → typecheck 0.

Positive fabrications still caught (`כבר שלחתי`, `דיברתי עם … והכל סודר`) — proven by retained assertions.

### Honest limits (NOT closed this session — blockers, not scope cuts)
- **PHYSICAL_ONLY:** real mic Hebrew capture, audible warmth/prosody, on-device latency feel, WhatsApp/dialer launch.
- **LIVE-PROVIDER BLOCKED:** the configuration tournament (VAD/voice/model/eagerness) and true audio-native duplex need a live OpenAI Realtime session unavailable here.
- **DEPLOYED-TELEMETRY BLOCKED:** baseline latency/failure distributions need an instrumented deployed candidate with traffic. Not fabricated.

### Certification of the truth-monitor fix (0.173.0 → 0.174.0)
Added 22 adversarial Hebrew variants (10 MUST-FLAG 1st-person completions; 11 MUST-NOT-FLAG truthful/negated/2nd-person/offer/forward) + capability-denial both ways (exists → flag; genuinely absent → do not flag). Dimensions: punctuation, ו/כ/ש prefixes, mixed clauses, questions, leading/trailing/ש-prefixed negation, future-offer vs past-completion. Result: real 1st-person fabrication detection NOT weakened; all forward-Hebrew false positives closed. Gates: truthMonitor+livePath 27, version contract 35, **full suite 11944/2 todo**, typecheck 0, build exit 0. Accepted bound: deeply nested negation ("לא אמרתי ששלחתי") — ADR-0001 §7 keeps the monitor bounded (structural receipt guarantee is primary); logged as RT-RISK-005.

## Destructive / mutation QA sweep (0.175.0) — DONE
`src/screens/AbuAI/realtime/destructiveSweep.test.ts` (14 tests) attacks the REAL adapter chain (controller → orchestrator → control-plane reducer + kernel dispatch → viewModel → truth monitor), not unit repeats. Seams: stale generation/revision rejection; cancel/replace WHILE a tool result is in flight (real async race, latest-intent-wins); exactly-once across duplicate+reordered completion shapes; phone-in-args privacy (controller + dispatchTool); safe-label vs local-phone resolution; fallback/reconnect not reviving a cancelled action; greeting-once across reconnect; one canonical card==receipt revision.

**New defect found + fixed — CD-FN-001 (High):** the capability-denial monitor caught "לא יכולה להתקשר" but NOT "לא יכולה לחייג" (to dial) → a READY call capability could be denied unchecked. Red-first regression → mechanism fix (add dial verb) → green.

**Sweep proven non-vacuous (mutation testing):**
- control-plane: dropped the generation check in TOOL_RESULT → "pre-fallback tool result REJECTED" went RED; reverted via `git checkout`.
- truth-monitor: emptied the `NEG` negation guard → 4 negation/forward sentinels went RED; restored.

Gates: sweep+monitor+livePath 42, version contract 22, **full suite 11959/2 todo (423 files)**, typecheck 0, build exit 0.

## Execution control bootstrap (d087f60 + hardening) — DONE
Machine-enforced execution system so the Definition of Done cannot silently shrink:
- `npm run qa:production-gate` — deterministic gate (`src/engineering-os/productionGate.ts`,
  pure; `scripts/qa-production-gate.ts` CLI). Currently FAILS: **13 open automatable
  Critical/High** (+ `STALE_FINGERPRINT` until execution step 1 re-fingerprints).
- Derived `scorecard.json` v2 (24 rows) + `product-inventory.json` manifest reconciled
  by the gate (`MISSING_INVENTORY_ROW`).
- Adversarial gate tests (18) reject every false-green class AND pass a complete fixture.
- Loop-safe Stop guard (`scripts/abu-stop-guard.mjs`) + `abu:goal:{arm,status,disarm}`;
  full lifecycle proven; disarmed by default so no session is trapped.
- Project skill `.claude/skills/abu-production` (discoverable) + 8 read-only specialist agents.

### Self-hostile review of the gate (bootstrap defects found + fixed)
- Gate bypasses closed: row-deletion (→ inventory manifest), deleted/nonexistent cited
  evidence (→ `fileExists` `MISSING_TEST_FILE`/`MISSING_EVIDENCE_ARTIFACT`), prefix-only
  fingerprint (→ full-40-hex `PREFIX_ONLY_FINGERPRINT`), copied evidence (→ `DUPLICATE_EVIDENCE`).
- Real false-green caught: `PRIVACY-KEYS` cited a nonexistent `src/services/…` path;
  fixed to `src/clientProviderKeyContract.test.ts`.
- Windows-safe: CLI uses `fileURLToPath`; guard reads stdin defensively; forward-slash paths.

## Production-candidate execution — live progress (gate-driven)
Gate at goal start: 13 open automatable Critical/High. **Now: 11 open** (build 0.176.0, HEAD ec0038f, source-aware fingerprint sealed, HEAD==remote).

CLOSED with full evidence (impl + independent verifier + mutation/round-trip + strongest path):
- **LATENCY-VAD-INSTRUMENTATION** (INTEGRATION) — `latencyInstrumentation.ts` pure timing substrate; independent verifier + mutation proof (flip delta → 6 fail).
- **DEPLOY-PREVIEW-RC** (DEPLOYED_PREVIEW) — 0.176.0 deployed to stable RC; cache-busted /api/health == tested build. `deploy-evidence.json#deploy`.
- **ROLLBACK** (DEPLOYED_PREVIEW) — re-alias round-trip proven + restored; honest limit (prior deploy shared build label). `deploy-evidence.json#rollback`.
Also: gate staleness is now SOURCE-aware + `npm run qa:seal` (two-commit seal keeps the fingerprint fresh under active commits).

Environment capability probe (for honest classification):
- Vercel authed (leomilstein-7548), network OK → DEPLOYED_PREVIEW rows achievable.
- Playwright + chromium/webkit installed → BROWSER rows (FEATURE-ACTIVATION, PWA-UPDATE) achievable locally/against RC.
- `.env` defines VITE_OPENAI_API_KEY/OPENAI_API_KEY/GROQ/GEMINI/AZURE (values redacted). Live WebRTC Realtime audio session (RT-LIVE-SESSION) still needs a browser+mic; ONLINE-CURRENT-INFO retrieval may be probeable via the key.

REMAINING 11 open + next action per row:
- FEATURE-ACTIVATION (BROWSER) → Playwright: load RC `?voice=realtime2`, assert activation state.
- PWA-UPDATE (BROWSER) → Playwright: SW registration + update + persistence across reload.
- HEBREW-CORPUS / LONG-SESSION-CONTEXT / DIALOGUE-QUALITY (INTEGRATION) → bind to existing conversation modules (conversationBrainQuality/companionQuality/…) with a new adversarial corpus + independent verifier + mutation; confirm no second brain.
- WHOLE-PRODUCT-QA (INTEGRATION) → extend property/race/fault/mutation beyond realtime to storage/PWA/online seams.
- CAL-MIGRATION (PRODUCTION_ADAPTER) → audit existing AbuCalendar (mature: calendarPipeline/EventBuilderV2/MutationReasoner + AbuCalendar/*), migrate under control plane REUSING it (no fork), injected-event tests.
- CONFIG-TOURNAMENT (INTEGRATION) → build runner + frozen corpus + metric matrix (offline); live exec needs creds.
- ONLINE-CURRENT-INFO / RT-LIVE-SESSION (LIVE_PROVIDER) → probe live access; if blocked after all prep, record failed-access probe → external.
- BASELINE-METRICS (DEPLOYED_PREVIEW) → wire latencyInstrumentation emit in deployed session; collect distributions.

## PHYSICAL_PROTOCOL (run on a real iPhone; 1–5 rubric, explicit pass/fail)
1. Hebrew mic capture, quiet + noisy — transcript accepted, no infinite "מקשיבה…" (pass = bounded).
2. Short + long utterances, meaningful pauses, fast speech — no premature turn end.
3. Interruption at start / middle / end + repeated interruption — obsolete audio stops, no accepted input lost.
4. Correction + frustration + complaint-about-the-system — exits action clarification immediately.
5. WhatsApp↔Call handoff + Calendar field correction — one state authority, unrelated fields preserved.
6. Fallback / reconnect mid-tool — committed draft preserved.
7. Actual WhatsApp launch + actual dialer launch (manual send/dial only).
8. Voice warmth, clarity of names/dates, pacing, latency feel, cognitive effort (perceptual 1–5).
Each physical failure → permanent automated/simulated regression where technically possible.
