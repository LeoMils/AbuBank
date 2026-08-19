---
description: Engineering rules for the self-improvement (Evolution) subsystem
globs: "src/evolution/**"
alwaysApply: false
---
# Rule: Evolution subsystem (engineering)

**Applies to:** `src/evolution/**` (observe → ingest → evaluate → release self-improvement loop).

- **Do not rebuild Evolution.** It already models signals, ingestion, evaluation, evidence queue,
  and release state. Reuse its types (`traceEnvelope`, `failureTaxonomy`) — avoid parallel
  evidence systems (the shared schema lives at `src/engineering-os/evidence.ts`).
- **Redact before storing real transcripts.** Use `evolution/redaction` — no phone/medical/
  financial/street data enters a stored trace or gold replay.
- Any improvement proposal requires evidence attached (evidence class + first divergence),
  not a bare assertion. Proposals are reviewed, not auto-applied.
- Failures feed the taxonomy and regression clustering — a new failure should map to a cluster,
  not a one-off patch.
