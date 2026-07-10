# Evolution OS — Traceability Matrix (Phase 1)

Every major requirement maps to: **Mechanism → Instrumentation → Test → Metric/SLO →
Release Gate → Rollback**. A row with a real passing test is HIGH evidence; a row
without is marked *deferred* honestly. Test files are under `src/evolution/`.

| # | Requirement (Section) | Mechanism (file) | Test (passing) | Metric/SLO | Release Gate | Rollback |
|---|---|---|---|---|---|---|
| 1 | Observe real behavior (§1,6) | `traceEnvelope.buildEnvelope` derived from serving plane; wired at `executiveCognitiveController` | `observer.test.ts` (captures a turn) | events captured/turn | Gate 1 Reproduction | flag `EVOLUTION_KILL` |
| 2 | Central Law: no self-rewrite from raw feedback (§3) | `config.isBehaviorChangeAllowed=false` in OBSERVE_ONLY; observer returns void | `observer.test.ts` (behavior-change not allowed) | mode==observe_only | Gate 11 Human approval | mode revert (code) |
| 3 | Data minimization + no secrets (§6,19) | `redaction.redactText/redactDeep/assertInert` | `redaction.test.ts` (secrets removed, PII masked, inert) | secretsRemoved, pii classes | Gate 6 Safety/Privacy | n/a (pure) |
| 4 | Durable, idempotent, offline queue (§18) | `evidenceQueue` on `KVBackend` (IndexedDB) | `evidenceQueue.test.ts` (dedup, offline reopen, dead-letter, corruption, purge) | pending/deadLetter counts | Gate 7 Runtime | ring cap + purge |
| 5 | Explicit signals (§7) | `signals.detectExplicit` (bilingual) | `signals.test.ts` (he/es correction, undo, confirmation) | user_correction rate | Gate 3 Regression | strength gate |
| 6 | Implicit signals (§7) | `signals.detectImplicit` | `signals.test.ts` (immediate_repeat) | repeat rate | — | bronze cannot learn |
| 7 | Automatic deterministic signals (§7) | `signals.detectAutomatic` | `signals.test.ts` (claimed_saved_not_committed, no_info_but_returned, unapproved) | unsupported-claim rate | Gate 2 Root cause | — |
| 8 | Signal strength gates learning (§7) | `signals.mayDriveLearning` | `signals.test.ts` | gold/silver/bronze mix | Gate 3 | bronze excluded |
| 9 | Failure classified at earliest layer (§8) | `failureTaxonomy.firstDivergence/earliestLayer` | `acceptanceScenarios.test.ts` (Scenario C) | first-divergence layer | Gate 2 | — |
| 10 | Root-cause status incl. UNKNOWN (§9) | `failureTaxonomy.RootCauseStatus`; state machine routes UNKNOWN→instrument | `stateMachine.test.ts` | supported/unknown ratio | Gate 2 | revisit loop |
| 11 | Generalize to a family + controls (§10) | `generalization.generalize` | `acceptanceScenarios.test.ts` (family + preserved control) | family size, control count | Gate 4 Preservation | — |
| 12 | Improvement Bundle, inert, no raw dumps (§11) | `improvementBundle.buildBundle` | `acceptanceScenarios.test.ts` (inert, classes, controls travel) | bundle provenance | Gate 3/4 | — |
| 13 | Candidate intervention CLASSES not code (§12) | `improvementBundle.candidateClassesForLayer` | `acceptanceScenarios.test.ts` | classes/ layer | — | — |
| 14 | Baseline-vs-candidate, paired, per-domain (§13,15) | `evaluation.evaluate` | `evaluation.test.ts` (ADVANCE/REJECT/NO_SAFE_WINNER) | per-domain pass% | Gate 3–5 | REJECT |
| 15 | P0 invariants zero-tolerance (§15) | `evaluation` p0Violation short-circuit | `evaluation.test.ts` (single P0 rejects) | P0 violations = 0 | Gate 6 | REJECT |
| 16 | Holdout integrity, no paraphrase leak (§14) | `evaluation.detectHoldoutContamination` | `evaluation.test.ts` | contamination = 0 | Gate 5 Holdout | — |
| 17 | Knowledge correction = evidence not truth (§20) | `knowledgeProposal.proposeFromCorrection` | `knowledgeProposal.test.ts` (Scenario A) | proposals/ auto-apply rate | Gate 6 | previousValue preserved |
| 18 | Conflict with trusted → quarantine (§20) | `knowledgeProposal` conflict logic | `knowledgeProposal.test.ts` (Scenario E) | quarantine rate | Gate 6 | never overwrites |
| 19 | Secure ingestion boundary (§19) | `ingestion.ingestEvent/ingestBatch` | `ingestion.test.ts` (schema/payload/idempotency/secret) | rejected/ dead-letter | Gate 6 | dead-letter path |
| 20 | Malicious feedback stays inert (§13-E, Scenario F) | `ingestion` + `redaction.assertInert/looksLikeInjection` | `ingestion.test.ts` (Scenario F) | injectionSuspected count | Gate 6 | inert by construction |
| 21 | 21-state case machine, append-only (§5) | `stateMachine.transition` | `stateMachine.test.ts` (legal/illegal, append-only) | cases by state | Gate 1–11 | history retained |
| 22 | Governance: proposer≠sole approver (§3D) | `stateMachine` HUMAN_ONLY_TARGETS | `stateMachine.test.ts` (automation blocked from HUMAN_APPROVED) | — | Gate 11 | — |
| 23 | Reversible release + auto-rollback (§17, Scenario H) | `release.evaluateRollback/ReleaseRegistry` | `release.test.ts` (invariant→auto, threshold→recommend, known-good) | SLO breaches | Gate 8 Reversibility | rollback to known-good |
| 24 | Operator health report (§28) | `report.buildHealthReport/renderHealthReport` | *covered via `report.ts` pure fns (unit pending)* | safeToPromote flag | — | — |
| 25 | Kill switches global + per-domain (§17) | `config.isDomainEnabled/isObservationAllowed` | `observer.test.ts` (global + per-domain kill) | — | — | instant no-op |

## Deferred (honest — NOT claimed as working)

| Requirement | Reason | Unblock |
|---|---|---|
| Server persistence / upload of evidence | No datastore provisioned — STOP (infra/creds) | provision store + host `ingestion.ts` |
| Shadow / preview / canary **execution** | needs infra + human approval | wire live traffic behind flags |
| Candidate **patch** generation (Level-3) | out of slice 1 by design (§4, §23) | isolated dev env + human review |
| Modality-aware capture at controller | controller is modality-agnostic today | thread `modality` into `executiveHandleTurn` |
| `report.ts` dedicated unit test | pure fns used by observer path; test pending | add `report.test.ts` |
