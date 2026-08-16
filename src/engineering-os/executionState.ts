/*
 * EXECUTION CONTINUITY GATE — release-state is NOT execution-state.  (Stage 3C §2)
 * ════════════════════════════════════════════════════════════════════════════════
 * The prior session stopped after one proven control layer while machine-closable
 * work remained. That is a control escape. This gate makes the distinction MACHINE
 * DETERMINISTIC:
 *   RELEASE_STATE  ∈ GO | NO_GO | BLOCKED | INVALID  (can the product ship?)
 *   EXECUTION_STATE ∈ CONTINUE_MACHINE_WORK | AUTHORITY_REQUIRED |
 *                     PRODUCT_DECISION_REQUIRED | CONTEXT_HARD_STOP | ELIGIBLE_FOR_STAGE4
 *
 * CORE INVARIANT (§2): RELEASE_STATE = NO_GO or BLOCKED does NOT permit stopping.
 * If machine-closable engineering work remains AND tools/permissions allow it, the
 * execution state is CONTINUE_MACHINE_WORK. Difficulty is never authority; repeated
 * failed repair triggers ROOT_CAUSE_REASSESSMENT, not reclassification to AUTHORITY.
 */

export type ReleaseVerdict = 'GO' | 'NO_GO' | 'BLOCKED' | 'INVALID'
export type ExecutionState =
  | 'CONTINUE_MACHINE_WORK'
  | 'AUTHORITY_REQUIRED'
  | 'PRODUCT_DECISION_REQUIRED'
  | 'CONTEXT_HARD_STOP'
  | 'ELIGIBLE_FOR_STAGE4'

export interface ExecutionStateInput {
  releaseVerdict: ReleaseVerdict
  /** Is there engineering work the machine can in principle do right now? */
  machineClosableWorkRemains: boolean
  /** All Stage-3 exit criteria (§53) are satisfied. */
  allStage3ExitCriteriaMet: boolean
  /** A REAL external permission/credential/deploy boundary blocks continuation. */
  authorityBoundary?: { required: boolean; exactNeed: string }
  /** A genuine product/policy choice between legitimate outcomes is required. */
  productDecision?: { required: boolean; choice: string }
  /** A real context/tool hard limit prevents continuation (NOT mere task size). */
  contextHardStop?: boolean
}

export interface ExecutionStateResult {
  state: ExecutionState
  reason: string
}

/**
 * Derive the execution state. Precedence is deliberate:
 *   1. All exit criteria met            → ELIGIBLE_FOR_STAGE4.
 *   2. Machine work remains + tools OK   → CONTINUE_MACHINE_WORK (overrides NO_GO/BLOCKED).
 *   3. Only a real authority boundary    → AUTHORITY_REQUIRED.
 *   4. Only a real product decision      → PRODUCT_DECISION_REQUIRED.
 *   5. Real context/tool hard limit      → CONTEXT_HARD_STOP.
 * A BLOCKED/NO_GO release NEVER by itself yields a stop.
 */
export function deriveExecutionState(input: ExecutionStateInput): ExecutionStateResult {
  if (input.allStage3ExitCriteriaMet && input.releaseVerdict === 'GO') {
    return { state: 'ELIGIBLE_FOR_STAGE4', reason: 'all Stage-3 exit criteria satisfied and release GO' }
  }
  // Machine-closable work ALWAYS wins over a non-GO release verdict (§2 EC1/EC2).
  if (input.machineClosableWorkRemains) {
    return { state: 'CONTINUE_MACHINE_WORK', reason: `release ${input.releaseVerdict} but machine-closable work remains — do not stop` }
  }
  // Only when NO machine work remains may a genuine external boundary end execution.
  if (input.authorityBoundary?.required) {
    return { state: 'AUTHORITY_REQUIRED', reason: `no machine work remains; external authority needed: ${input.authorityBoundary.exactNeed}` }
  }
  if (input.productDecision?.required) {
    return { state: 'PRODUCT_DECISION_REQUIRED', reason: `no machine work remains; product choice needed: ${input.productDecision.choice}` }
  }
  if (input.contextHardStop) {
    return { state: 'CONTEXT_HARD_STOP', reason: 'a real context/tool hard limit prevents continuation; checkpoint persisted' }
  }
  // No work, no boundary, not eligible → the model is under-specified; fail safe to
  // continue rather than silently stop (never convert absence into a stop).
  return { state: 'CONTINUE_MACHINE_WORK', reason: 'no explicit stop condition proven; default is to keep working' }
}
