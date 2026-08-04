# Prompt & Assumption Audit — Abu AI Production Convergence

Corrections to prior ChatGPT/Claude prompts and repository artifacts. This file
exists to improve execution; it is **not** a terminal result.

## Corrected flaws

1. **Subsystem completion presented as product completion.** Prior runs treated a
   green Communication/Realtime slice as "done". Corrected: the fixed denominator
   (see `FINAL_EXECUTION_SPEC.md`) counts the whole product; a slice is a checkpoint.
   Enforced by `scorecard.json` rows + `npm run qa:production-gate`.

2. **Manually-editable "green" status.** Earlier scorecards used free-text status
   that could be hand-greened. Corrected: status is now a *derived contract* — a
   Critical/High automatable row is green only with PROVEN + evidence-class ≥
   required + a test/artifact + a build fingerprint == candidate. The gate rejects
   fabricated green (`FALSE_GREEN`, `EVIDENCE_DEFICIT`, `STALE_ROW_BUILD`).

3. **Injected-event / test-only evidence labeled as live.** Corrected: the evidence
   ladder distinguishes `PRODUCTION_ADAPTER` (injected-event, real seam) from
   `LIVE_PROVIDER` / `PHYSICAL_DEVICE`. Realtime rows are honestly capped at
   `PRODUCTION_ADAPTER`; mic/acoustic rows are `physical`.

4. **Physical/external used to hide automatable work.** Corrected: `EXTERNAL_BLOCKER`
   and `PHYSICAL_ONLY` require `blockerProof`; an automatable Critical/High surface
   marked external/physical without proof trips `UNPROVEN_BLOCKER_HIDES_WORK` /
   `MISCLASSIFIED_*`. External is only valid after all prep + failed-access evidence.

5. **Changing denominator.** Corrected: `FINAL_EXECUTION_SPEC.md` fixes the 100%
   definition; the gate counts open automatable Critical/High rows deterministically.

6. **Contradictory STOP/continue instructions (esp. Calendar).** Prior guidance both
   demanded Calendar migration and treated architectural risk as an unconditional
   STOP. The `/goal` message §4 resolves this: Calendar migration under ADR-0001 is
   authorized; audit first, reuse mechanisms, stop only on executable ADR
   contradiction. `CAL-MIGRATION` is now an open automatable row, not a deferral.

7. **Oversized cumulative build labels.** Prior version metadata accreted multi-KB
   labels across releases. Corrected going forward: concise version labels; history
   lives in `worklog.md` / commit messages, not the label.

8. **Ceremonial / duplicate QA.** Complaint/meta and pathological-ordering handling
   were already covered (controlPlane/orchestrator/adversarial). New tests must add
   a genuine first-divergence, not re-assert covered behavior.

9. **Endless-reporting risk.** Prior prompts invited terminal reports at every
   checkpoint. Corrected: checkpoints persist state + surface only delta + next
   action; the gate (not prose) is the completion oracle.

## Bootstrap defects found and corrected (self-hostile review)

- **My own gate was gameable — fixed.** Hostile review of the gate found three real
  bypasses, now closed with failing-first tests:
  1. deleting an entire row lowered the count and could PASS → added a
     machine-readable `product-inventory.json` manifest; the gate reconciles required
     Critical/High ids (`MISSING_INVENTORY_ROW`).
  2. a PROVEN row could cite a **deleted/nonexistent** test/artifact → the CLI now
     injects `fileExists`; the gate raises `MISSING_TEST_FILE` / `MISSING_EVIDENCE_ARTIFACT`.
  3. a **prefix-only** commit fingerprint was accepted → now requires a full 40-hex
     SHA (`PREFIX_ONLY_FINGERPRINT`); copied evidence across rows raises `DUPLICATE_EVIDENCE`.
- **False-green in my own scorecard — fixed.** `PRIVACY-KEYS` cited
  `src/services/clientProviderKeyContract.test.ts`, which does not exist; the real
  path is `src/clientProviderKeyContract.test.ts`. The new `MISSING_TEST_FILE` check
  is exactly what caught it.
- **Frontmatter corruption hypothesis — disproven by bytes.** `od -c` on
  `SKILL.md` and every agent shows `- - - \n n a m e :` (`---\nname:`); the
  missing-first-character was a transcript rendering artifact, not a file defect.
- **Classification review (item 7) — confirmed correct + sharpened.** The live
  Realtime PATH is `automatable` (control plane/kernel/controller PROVEN), not
  physical. Only genuine mic/acoustic/subjective rows are `physical` (`VOICE-DEVICE`,
  `TTS-WARMTH`). Added `RT-LIVE-SESSION` (automatable, min `LIVE_PROVIDER`) to
  separate the live-provider *session* from mic/acoustic. Runner readiness
  (`LATENCY-VAD-INSTRUMENTATION`, `CONFIG-TOURNAMENT`, `BASELINE-METRICS`) stays
  `automatable`/open — distinct from unavailable live execution. No row is
  `EXTERNAL_BLOCKER` without `blockerProof`.
- **Stop-guard lifecycle — completed.** Deterministic `npm run abu:goal:{arm,status,
  disarm}`; proven disarmed=no-op, armed=block, pass=allow, backstop=release; documented rollback.

## Assumptions to re-verify at execution time (not yet proven defects)

- Latest tested build (0.175.0) is **not** yet deployed to Preview/stable RC
  (`DEPLOY-PREVIEW-RC` row is `TESTED_NOT_DEPLOYED`).
- `response.done` carrying multiple parallel function calls: `extractFunctionCall`
  returns only the first (RT-RISK-002) — inspect against current OpenAI Realtime docs
  before hardening; each parallel call normally also arrives as its own
  `output_item.done`.
- Feature activation may require multiple persisted URL operations — verify the
  exact one-step activation (`FEATURE-ACTIVATION` row).
- Calendar still lives outside the realtime authority — confirmed by grep; audit
  `AbuCalendar` before editing.
- Long-session summaries and conversation-quality lack executable evidence — build
  the corpus/runner, do not assume.
