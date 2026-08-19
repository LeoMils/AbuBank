/*
 * CONTEXT EXECUTION STATE — a CONTEXT_HARD_STOP must be EVIDENCED, not declared. (§2)
 * ════════════════════════════════════════════════════════════════════════════════
 * The prior session exited CONTEXT_HARD_STOP without a machine-observable hard-limit
 * signal (no context-budget telemetry was available to the agent). Per §2 that is an
 * EXECUTION_CONTROL_ESCAPE: a self-declared stop is not a hard stop. This module makes
 * the distinction deterministic so "context concern" can never again become an escape
 * hatch from CONTINUE_MACHINE_WORK.
 *
 * A checkpoint is PERSISTENCE, not an exit. When context pressure is suspected but no
 * hard limit is proven, the correct state is PREEMPTIVE_CHECKPOINT while execution
 * CONTINUES.
 */

export type ContextExecutionState =
  | 'CONTEXT_HEALTHY'
  | 'CONTEXT_PRESSURE'
  | 'CONTEXT_CHECKPOINT_RECOMMENDED'
  | 'CONTEXT_HARD_STOP'

export interface ContextStateInput {
  /** Is machine-readable context-budget telemetry actually available to the agent? */
  telemetryAvailable: boolean
  /** Fraction of context used, ONLY if telemetryAvailable. Ignored otherwise. */
  usedFraction?: number
  /**
   * A REAL machine-observable hard-limit signal: harness/tool context exhaustion, an
   * explicit system limit, or a proven inability to preserve required execution state.
   * A percentage estimate is NOT this signal.
   */
  hardLimitSignal: boolean
  /** Whether machine-closable work still remains (affects CONTINUE, not HARD_STOP). */
  machineWorkRemains: boolean
}

export interface ContextStateResult {
  state: ContextExecutionState
  /** True iff execution must actually end (only a real hard stop). */
  mustStop: boolean
  reason: string
}

/**
 * Derive the context-execution state. CONTEXT_HARD_STOP requires an actual
 * hardLimitSignal. Without telemetry AND without a hard signal, the strongest state is
 * CONTEXT_CHECKPOINT_RECOMMENDED (persist + continue) — never HARD_STOP.
 */
export function deriveContextState(input: ContextStateInput): ContextStateResult {
  if (input.hardLimitSignal) {
    return { state: 'CONTEXT_HARD_STOP', mustStop: true, reason: 'a real machine-observable hard limit prevents safe continuation' }
  }
  if (input.telemetryAvailable && typeof input.usedFraction === 'number') {
    if (input.usedFraction >= 0.9) return { state: 'CONTEXT_CHECKPOINT_RECOMMENDED', mustStop: false, reason: `telemetry ${Math.round(input.usedFraction * 100)}% — persist a checkpoint and continue` }
    if (input.usedFraction >= 0.7) return { state: 'CONTEXT_PRESSURE', mustStop: false, reason: `telemetry ${Math.round(input.usedFraction * 100)}% — pressure, continue` }
    return { state: 'CONTEXT_HEALTHY', mustStop: false, reason: `telemetry ${Math.round(input.usedFraction * 100)}%` }
  }
  // No telemetry, no hard signal → we cannot assert a hard stop. Persist + continue.
  return { state: 'CONTEXT_CHECKPOINT_RECOMMENDED', mustStop: false, reason: 'no context telemetry and no hard-limit signal — a checkpoint is persistence, not an exit; continue' }
}

/**
 * A record of a context-stop that was NOT backed by a hard-limit signal. This is a
 * control escape to be surfaced and regression-tested, not hidden.
 */
export interface ExecutionControlEscape {
  escapeId: string
  claimedState: ContextExecutionState
  hadHardLimitSignal: boolean
  verdict: 'EXECUTION_CONTROL_ESCAPE' | 'JUSTIFIED'
}

/** Classify a past exit. A CONTEXT_HARD_STOP without a hard signal is an escape. */
export function classifyPastExit(claimed: ContextExecutionState, hadHardLimitSignal: boolean, escapeId: string): ExecutionControlEscape {
  const isEscape = claimed === 'CONTEXT_HARD_STOP' && !hadHardLimitSignal
  return { escapeId, claimedState: claimed, hadHardLimitSignal, verdict: isEscape ? 'EXECUTION_CONTROL_ESCAPE' : 'JUSTIFIED' }
}
