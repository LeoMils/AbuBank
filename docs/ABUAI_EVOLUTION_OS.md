# AbuAI Evolution OS — Architecture (Phase 1)

> Evolution OS is the evidence / diagnosis / evaluation / controlled-improvement
> system **beneath** AbuAI. AbuAI is the user-facing intelligence; Evolution OS
> never rewrites it from raw feedback. This document describes what is **built and
> tested** in `src/evolution/` (slice 1), and what is explicitly deferred.
> Status of each capability is in the Evidence Scorecard of the final report and in
> `ABUAI_EVOLUTION_TRACEABILITY_MATRIX.md`.

## 1. The Central Law (Section 3)

The live assistant must never directly rewrite itself from raw user feedback. This
is enforced **structurally**, not by discipline:

- `src/evolution/config.ts` ships default `mode: 'observe_only'`. `isBehaviorChangeAllowed()`
  returns **false** in that mode. The observer returns `void` and holds no reference
  the serving plane reads back. Evidence flows IN; nothing flows OUT to the answer.
- Escalation past OBSERVE_ONLY is a **code + human** change. `resolveConfig(env)` can
  only ever make Evolution *safer* (a kill switch) — env can never escalate the mode.

## 2. The four planes

| Plane | Where | What it does |
|---|---|---|
| **A. Serving** | existing `executiveCognitiveController` → `runFullTurn` → `finalize` | produces the user's answer (unchanged) |
| **B. Evidence** | `traceEnvelope.ts` + `evidenceQueue.ts` | one redacted, versioned, integrity-stamped envelope per turn, durably queued |
| **C. Evolution** | `signals.ts`, `failureTaxonomy.ts`, `generalization.ts`, `improvementBundle.ts`, `ingestion.ts`, `evaluation.ts`, `knowledgeProposal.ts` | classify → reproduce → localize → generalize → bundle → evaluate |
| **D. Governance/Release** | `stateMachine.ts`, `release.ts` | the 21-state case machine + reversible release/rollback; automation cannot reach production states |

## 3. Integration seam (OBSERVE_ONLY)

`executiveCognitiveController.executiveHandleTurn` already calls `recordTurn(...)`
once per turn. Immediately after, it now calls `observeTurn(facts, EVOLUTION_CFG)`:

```
turn → executiveHandleTurn → [answer returned to UI]
                           ↘ recordTurn (existing diagnostics)
                           ↘ observeTurn  (Evolution OS, OBSERVE_ONLY)
                               → buildEnvelope (redact + minimize + integrity)
                               → EvidenceQueue.enqueue (idempotent, durable)
                               → detectSignals (window of recent envelopes)
                               → open case for GOLD failure signals (state machine)
```

`observeTurn` is wrapped so it can **never throw into a turn**; every internal path
is also guarded. A global or per-domain kill switch makes it a cheap no-op.

## 4. Trace Envelope (Section 6)

`AbuTraceEnvelope` (`traceEnvelope.ts`, `schemaVersion 1.0.0`) is **derived from**
what the serving plane already emits — we did not re-instrument the pipeline. Data
minimization is enforced at construction:

- All free text is redacted (`redaction.ts`) before it is stored. Raw input is never
  stored — only the redacted normalized form. Raw audio is never collected.
- `integrity.idempotencyKey` = stable hash of `session|turn|input|answer` → duplicate
  delivery can never create duplicate evidence.
- `privacy` block records redaction status, PII classes, and secrets removed.
- `assertInert` JSON round-trips the envelope so only plain data leaves the builder.

## 5. Signals (Section 7)

`signals.ts` — three families, three strengths, **bilingual (Hebrew + Rioplatense)**:

- **explicit** — the user said it (correction / undo / thanks). The *next* turn judges
  the *prior* turn.
- **implicit** — behavior implies it (immediate repeat, modality switch). Probabilistic.
- **automatic** — deterministic trace contradictions: `claimed_saved_not_committed`,
  `no_info_but_retrieval_returned`, `tts_diverges_from_approved`, `unapproved_answer_emitted`,
  `silent_fallback`.

Strength gates learning: **GOLD** may open a case; **SILVER** corroborates; **BRONZE**
may only cluster (`mayDriveLearning`). Success signals are captured too, so the system
never learns only from complaints.

> **Engineering note:** JavaScript's `\b` is ASCII-only and never matches beside a
> Hebrew letter. The first pass silently disabled every Hebrew detector; the fix (and
> its regression test) is why the test suite, not a grep, is the evidence here.

## 6. Failure taxonomy & root cause (Sections 8–9)

`failureTaxonomy.ts` names 35 layers ordered by causal precedence. `firstDivergence()`
picks the **earliest** failing layer and lists later symptoms as downstream — the
"don't start from the final answer" rule made mechanical. Root-cause status is
`SUPPORTED | PARTIALLY_SUPPORTED | UNSUPPORTED | UNKNOWN`; **UNKNOWN is acceptable**,
an invented cause is not (the state machine routes UNKNOWN back to add instrumentation).

## 7. Generalization → Improvement Bundle (Sections 10–12)

`generalization.ts` expands one verified case into a causally diverse family
(alias, STT/typo, modality, gendered follow-up, adversarial) **plus preserved-invariant
controls**. `improvementBundle.ts` packages it into an inert, redacted bundle with
required regressions/holdouts/security/privacy checks and candidate intervention
**classes** (mechanisms, not code). Raw conversation dumps never reach repair automation.

## 8. Knowledge correction (Sections 4-L1, 20)

`knowledgeProposal.ts` — a correction is **evidence, not truth**. One utterance yields
a scoped proposal + provenance + conflict check + authorization check, **never** a
silent `Yarden.spouse = Eili`. A conflict with **trusted** knowledge is **quarantined**;
`previousValue` is always preserved; `mayAutoApply` is false unless non-conflicting,
authorized, high-confidence, non-global. This module produces proposals only — it never
writes `knowledge/*` or `memory/*` (human/skill-gated).

## 9. Evaluation & holdouts (Sections 13–16)

`evaluation.ts` compares baseline vs candidate on **identical paired cases** across
`dev / frozen / rolling / adversarial` partitions. **P0 invariants are zero-tolerance**
and never averaged into a score; a regression on a holdout or a preserved control →
`REJECT`. `detectHoldoutContamination` catches paraphrase leaks between generator inputs
and holdouts.

## 10. Ingestion & release (Sections 17, 19)

`ingestion.ts` is the secure boundary (validate schema, payload cap, redact, secret-scan,
idempotency, inert). It is a **pure, server-ready** transform run locally today —
**no server datastore is provisioned; provisioning one is a documented STOP** (infra/
credentials). `release.ts` keeps a known-good predecessor and turns a live SLO breach
into an auto-rollback (zero-tolerance invariant) or a rollback recommendation.

## 11. Operator health (Section 28)

`report.ts` answers, from live state: is collection working, are uploads delayed, are
events dead-lettered, is redaction OK, are P0 signals present, is it safe to promote?
In OBSERVE_ONLY, `safeToPromote` is always `false` — promotion is a human decision.

## 12. What is deliberately NOT built yet (honest gaps)

- **No server persistence / upload** — client-durable only (STOP: infra). The ingestion
  boundary is ready to host.
- **Candidate patch generation** (Level-3 code change) is intentionally out of slice 1.
- **Shadow/preview/canary execution** — the state machine, flags, and rollback logic
  exist and are tested; live shadow traffic is not wired (needs infra + human approval).
- **Modality** is hard-coded `text` at the controller seam; threading voice is a next step.
