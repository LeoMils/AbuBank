# Evolution OS — Threat Model & Risk/Coverage Matrix (Sections 19, 26)

The learning system must not become a source of uncontrolled risk. A broken learning
system that silently recommends bad changes is more dangerous than none. This is the
living risk matrix for slice 1.

## Trust boundaries

1. **Production evidence is UNTRUSTED data.** It is redacted at capture (`redaction.ts`)
   and re-redacted at the ingestion boundary (`ingestion.ts`) — defense in depth. It is
   never interpreted as code/instructions; `assertInert` guarantees only plain JSON data
   proceeds (`redaction.assertInert`, tested in `redaction.test.ts` / `ingestion.test.ts`).
2. **Serving plane ↔ Evolution plane is one-way.** OBSERVE_ONLY: `isBehaviorChangeAllowed`
   is false; the observer returns void. Nothing Evolution computes can reach the answer.
3. **Automation ↔ production is human-gated.** The case state machine blocks an automation
   actor from `HUMAN_APPROVED`/`DEPLOYED` (`stateMachine.test.ts`).

## Threats → mitigations → evidence

| Threat | Can it be silent? | Mitigation | Evidence |
|---|---|---|---|
| Secret/token in evidence | yes | `redaction` secret patterns + secret-named keys dropped; boundary re-scan | `redaction.test.ts`, `ingestion.test.ts` |
| PII leakage (phone/email/ID) | yes | masked, shape-only, never raw | `redaction.test.ts` |
| Prompt injection via feedback (Scenario F) | yes | inert data + `looksLikeInjection` flag (flag, never execute) | `ingestion.test.ts` |
| Duplicate delivery → duplicate learning | yes | idempotency key at queue + ingestion | `evidenceQueue.test.ts`, `ingestion.test.ts` |
| Poisoned correction corrupts graph (Scenario E) | yes | conflict with trusted → quarantine; `previousValue` preserved; `mayAutoApply` false | `knowledgeProposal.test.ts` |
| One user's fact overwrites another's | yes | scope defaults personal; `targetsOtherPerson`→authorization unknown | `knowledgeProposal.test.ts` |
| Candidate fixes A, breaks B (Scenario G) | yes | paired eval + preserved controls + holdout gate → REJECT | `evaluation.test.ts` |
| P0 invariant slips through on average | yes | zero-tolerance, never averaged | `evaluation.test.ts` |
| Holdout contamination via paraphrase | yes | `detectHoldoutContamination` on normalized text | `evaluation.test.ts` |
| Bad candidate reaches prod | no (human gate) | governance separation + human-only states | `stateMachine.test.ts` |
| Live regression after promotion (Scenario H) | partially | SLO breach → auto/recommend rollback to known-good | `release.test.ts` |
| Evolution crashes a live turn | no | `observeTurn` fully wrapped; every path guarded | `observer.test.ts` (never throws) |
| Queue corruption / app close mid-write | yes | corrupt records skipped on init; durable reopen; dead-letter | `evidenceQueue.test.ts` |
| Oversized/malformed event | yes | payload cap + schema validation → reject/dead-letter | `ingestion.test.ts` |

## Accepted / deferred risks (honest)

- **No server-side authentication of evidence source** — deferred with the server
  (STOP: infra). The boundary is built to authenticate when hosted.
- **Modality mislabeled as `text`** at the controller — voice/text divergence signals
  are under-powered until modality is threaded. Deferred, documented.
- **Bronze signals are heuristic** — by policy they cannot drive learning, only cluster.
- **`report.ts`** has no dedicated unit test yet — used on the observer path; deferred.

## Failure injection against the pipeline itself

Covered by tests: corrupt queue record on init, oversized payload, malformed ingestion
input, duplicate idempotency key, out-of-order upload acks, dead-letter after retries,
NaN/garbage turn facts to the observer. All handled without throwing or corrupting state.
