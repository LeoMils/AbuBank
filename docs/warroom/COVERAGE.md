# COVERAGE MATRIX — live

5 layers × 7 techniques. `✓` real coverage · `~` partial · `✗` empty/none found.
Grounded in an actual repo scan (Run 1, 2026-08-13), not assumed.

| | regression | simulator | adversary | invariants | metamorphic | differential | mutation |
|---|---|---|---|---|---|---|---|
| **A · Brain** | ✓ | ✓ | ~ | ~ | ✓ | ~ | ~ |
| **B · App** | ~ | ~ | ~ | ~ | ✗ | ~ | ✗ |
| **C · Platform** | ~ | – | ~ | ~ | ✗ | ~ | ✗ |
| **D · Journeys** | ✓ | ~ | ~ | ~ | ✗ | ✓ | ✗ |
| **E · Production** | ~ | – | ~ | ~ | ✗ | ~ | ✗ |

## Evidence per cell (what backs the mark)

### A · Brain
- **regression ✓** — `eval/deviceFailuresTriage`, `e2e/leo-device-failures.spec`,
  `e2e/latest-iphone-transcript-repro.spec`, dozens of gold replays (`eval/*GoldReplay`),
  `blockerFixes`, `closureRegressions`, per-defect tests across 199 AbuAI test files.
- **simulator ✓** — `martitaSimulation.test.ts`, `eval/productionSimulatorScenarios.ts`,
  `eval/freeLanguageSimulation.test.ts`, `e2e/abuai-production-simulator.spec.ts`.
- **adversary ~** — `adversarialTrust`, `realtime/sessionOrchestratorAdversarial`,
  `people/fuzzyMatch` fuzz. GAP: no systematic fuzz (emoji-only/numeric/huge/mixed-script) nor
  a prompt-INJECTION-through-data suite (message content / contact names / calendar titles).
- **invariants ~** — encoded in `services/textHarness/companionSuite.test.ts` but **KEY-GATED**
  (needs `OPENAI_API_KEY`). GAP: no always-on DETERMINISTIC invariant assertion over the corpus.
- **metamorphic ✓** — `familyReasonerProperties.test.ts` = full 68×68 inverse-consistency +
  BFS-path + determinism + 2000-query random-graph fuzz. (HE/ES same-fact & ask-twice: verify.)
- **differential ~** — `e2e/device-replay.spec`, `e2e/preview-parity.spec`. GAP: no automated
  "replay recorded device convos vs current build + diff" report as a standing gate.
- **mutation ~** — `scripts/mutation-harness.mjs` now exists (Phase M). Seeded with 7 deterministic
  mutants (redaction phone/email/secret/israeli-id, grandchild gender label, date yesterday, online
  honesty gate) + 1 negative control. Kill rate **100% (7/7)** after closing TWO survivors (family
  LABEL gender F1, Israeli-ID redaction F2). Online honesty gate (World-Cup incident) confirmed
  guarded. Still ~ not ✓: the brief's ~30 across all five layers (App touch-targets/RTL, Platform
  SW/idle, Journeys card→WhatsApp/confirm→two-events) are NOT yet seeded, and model-instruction P0s
  (distress) are out of deterministic scope (see OPEN O2). Expand the manifest.

### B · App (Playwright specs exist; techniques thin)
- Specs: `home-nav`, `contact-management`, `contact-photos`, `enlarged-text`,
  `family-record-screen`, `weather-smoke`, `feature-activation`, `focused-contact`.
- regression ~ / adversary ~ / invariants ~ / differential ~ = partial via those specs.
- **metamorphic ✗, mutation ✗** — none at app layer. GAP: systematic per-screen render/overflow/
  contrast/touch-target(≥56px)/RTL assertion sweep at 412×870 in BOTH themes (brief B1/B2/B3).

### C · Platform
- `service-worker.spec`, `persistence-lifecycle.spec`, `persistence.spec`, `container-isolation`,
  `provider-matrix`, `preview-parity`, `scripts/check-client-secret-leak.cjs`.
- **Security key-in-bundle: PROVEN this session** — no billable key; free-tier Groq present by
  documented allowance (see DECISIONS). metamorphic/mutation ✗.

### D · Journeys
- **regression/differential ✓** — `e2e/realtime-slice-journey`, `e2e/action-reachability`,
  `calendarJourney.test`, `e2e/device-replay`, `e2e/comm-*`, `e2e/whatsapp-voice-compose`.
- metamorphic ✗, mutation ✗.

### E · Production
- `scripts/rc-verify.ts`, `e2e/production-smoke.spec`, `qa:production-gate`, `qa:production-verdict`.
- Deployment path documented in `docs/engineering-os/MISSION_LEDGER.md` (`deploy:rc`).
- GAP: rollback proof, monitoring/heartbeat design (brief E2/E4), fresh-install "Abu speaks first".

## Empty cells named (brief requires this): 
**Mutation across ALL five layers** and **app/platform/journey/production metamorphic** are the
untested surface. Highest severity = **mutation (Phase M)** because it measures whether the
12662 green tests are real. Next = **always-on deterministic invariants** (P0-protecting).
