/*
 * YIELD GATE — CONTINUE_MACHINE_WORK is not a yield. (Stage 3C §1)
 * ════════════════════════════════════════════════════════════════════════════════
 * executionState.ts derives WHETHER machine work remains (the EXECUTION_STATE).
 * It does NOT decide whether the agent is permitted to hand control back to the user.
 * The prior session exposed the gap: it correctly derived EXECUTION_STATE =
 * CONTINUE_MACHINE_WORK and then still YIELDED to the user. Operationally, yielding
 * while machine-closable work remains IS an execution stop — a NEW escape distinct from
 * the CONTEXT_HARD_STOP escape closed in contextExecutionState.ts.
 *
 * This module makes the yield decision deterministic and separable from execution-state
 * derivation, so "I updated a report / persisted a checkpoint" can never again be
 * smuggled in as a reason to stop.
 *
 * CORE INVARIANT (§1):
 *   IF   EXECUTION_STATE = CONTINUE_MACHINE_WORK
 *   AND  a machine-executable next action exists
 *   AND  no genuine authority/product/context/tool boundary prevents execution
 *   THEN MAY_YIELD_TO_USER = FALSE  (execute the next machine action immediately).
 *
 * Persisting a checkpoint or updating a report is PROGRESS, never permission to yield.
 * Yielding is permitted ONLY at a genuine terminal/boundary state.
 */

import type { ExecutionState } from './executionState'

/** The only states at which returning control to the user is legitimate (§1). */
export type ValidYieldState =
  | 'ELIGIBLE_FOR_STAGE4'
  | 'AUTHORITY_REQUIRED'
  | 'PRODUCT_DECISION_REQUIRED'
  | 'CONTEXT_HARD_STOP'
  | 'TOOL_HARD_STOP'

export interface YieldGateInput {
  /** The derived execution state (from deriveExecutionState). */
  executionState: ExecutionState
  /** Is there a concrete machine action that could be executed RIGHT NOW? */
  machineExecutableNextActionExists: boolean
  /**
   * A genuine external boundary that actually prevents the next action. Only these end
   * execution; "difficulty", "a coherent subtask finished", or "a checkpoint was
   * written" are NOT boundaries.
   */
  boundary?: {
    kind: 'AUTHORITY' | 'PRODUCT_DECISION' | 'CONTEXT_HARD_STOP' | 'TOOL_HARD_STOP'
    /** Machine-observable evidence is REQUIRED for CONTEXT/TOOL hard stops (§1). */
    machineObservableEvidence?: boolean
    detail: string
  }
  /**
   * Whether a checkpoint was just persisted / a report updated. Recorded for honesty,
   * but by §1 it NEVER permits a yield — included so a caller cannot claim it was
   * "considered" as grounds to stop.
   */
  checkpointPersisted?: boolean
}

export interface YieldGateResult {
  mayYield: boolean
  /** Present only when mayYield is true. */
  yieldState?: ValidYieldState
  reason: string
}

/**
 * Decide whether the agent MAY yield to the user.
 *
 * Precedence:
 *  1. ELIGIBLE_FOR_STAGE4 always yields (terminal success).
 *  2. CONTINUE_MACHINE_WORK + an executable next action + no genuine boundary → DENY.
 *     (A checkpoint/report update does NOT flip this.)
 *  3. A genuine boundary yields — but CONTEXT/TOOL hard stops require machine-observable
 *     evidence; without it they are NOT a valid yield (they collapse to DENY).
 */
export function deriveYieldDecision(input: YieldGateInput): YieldGateResult {
  if (input.executionState === 'ELIGIBLE_FOR_STAGE4') {
    return { mayYield: true, yieldState: 'ELIGIBLE_FOR_STAGE4', reason: 'all Stage-3 exit criteria satisfied — terminal success' }
  }

  const b = input.boundary

  // A genuine authority / product-decision boundary is a valid yield regardless of
  // whether trivial work "could" be invented — these require a human/policy input.
  if (b?.kind === 'AUTHORITY') {
    return { mayYield: true, yieldState: 'AUTHORITY_REQUIRED', reason: `genuine authority boundary: ${b.detail}` }
  }
  if (b?.kind === 'PRODUCT_DECISION') {
    return { mayYield: true, yieldState: 'PRODUCT_DECISION_REQUIRED', reason: `genuine product decision required: ${b.detail}` }
  }

  // CONTEXT / TOOL hard stops are valid yields ONLY with machine-observable evidence.
  if (b?.kind === 'CONTEXT_HARD_STOP' || b?.kind === 'TOOL_HARD_STOP') {
    if (b.machineObservableEvidence) {
      return { mayYield: true, yieldState: b.kind, reason: `${b.kind} with machine-observable evidence: ${b.detail}` }
    }
    // Self-declared hard stop without evidence is the escape — deny the yield.
    return { mayYield: false, reason: `${b.kind} claimed WITHOUT machine-observable evidence — not a valid yield (execution-control escape); continue` }
  }

  // No valid boundary. If machine-executable work remains, yielding is DENIED — this is
  // the §1 core invariant, and it holds even if a checkpoint was just persisted.
  if (input.machineExecutableNextActionExists) {
    const note = input.checkpointPersisted ? ' (a checkpoint was persisted — that is progress, not permission to yield)' : ''
    return { mayYield: false, reason: `EXECUTION_STATE=${input.executionState} and a machine-executable next action exists${note} — MAY_YIELD_TO_USER=FALSE; execute it` }
  }

  // No boundary AND no executable next action AND not eligible: the model is
  // under-specified. Fail safe to CONTINUE (never convert absence into a yield).
  return { mayYield: false, reason: 'no valid yield boundary and no proven terminal state — do not yield; re-derive the next machine action' }
}

/*
 * EXECUTION-CONTROL ESCAPE — record a past exit that yielded while machine work
 * remained. The prior "CONTINUE_MACHINE_WORK then yield" is the canonical instance and
 * a PERMANENT regression (§1). This complements classifyPastExit() in
 * contextExecutionState.ts (which covers the CONTEXT_HARD_STOP escape).
 */
export interface YieldControlEscape {
  escapeId: string
  claimedExecutionState: ExecutionState
  yielded: boolean
  machineWorkRemained: boolean
  hadGenuineBoundary: boolean
  verdict: 'YIELD_CONTROL_ESCAPE' | 'JUSTIFIED_YIELD'
}

/**
 * Classify a past yield. Yielding while EXECUTION_STATE = CONTINUE_MACHINE_WORK and
 * machine work remained, WITHOUT a genuine boundary, is a YIELD_CONTROL_ESCAPE.
 */
export function classifyPastYield(
  claimedExecutionState: ExecutionState,
  machineWorkRemained: boolean,
  hadGenuineBoundary: boolean,
  escapeId: string,
): YieldControlEscape {
  const isEscape =
    claimedExecutionState === 'CONTINUE_MACHINE_WORK' && machineWorkRemained && !hadGenuineBoundary
  return {
    escapeId,
    claimedExecutionState,
    yielded: true,
    machineWorkRemained,
    hadGenuineBoundary,
    verdict: isEscape ? 'YIELD_CONTROL_ESCAPE' : 'JUSTIFIED_YIELD',
  }
}

/*
 * STANDING-AUTHORITY FIREWALL. (Stage 3C §1 correction)
 * ════════════════════════════════════════════════════════════════════════════════
 * A prior yield emitted AUTHORITY_REQUIRED for "deployment-related work" that was in
 * fact already covered by standing Stage-3C authorization (read-only runtime testing,
 * non-main commits/pushes, ephemeral/preview deploys, RC redeploy on a real fix, safe
 * provider calls). That is an AUTHORITY_CLASSIFICATION_FALSE_POSITIVE: difficulty,
 * ordering, or mere dependence on deployment infrastructure is NOT new authority.
 *
 * AUTHORITY_REQUIRED is valid ONLY for a genuinely NEW permission not already granted:
 * production deploy, merge to main, destructive git/fs, or an unintended real external
 * side effect. This firewall makes that distinction deterministic.
 */
export type AuthorityAction =
  // ── Covered by standing Stage-3C authorization ──
  | 'READ_ONLY_RUNTIME_TEST'
  | 'SAFE_RC_INSPECTION'
  | 'NON_MAIN_COMMIT_PUSH'
  | 'EPHEMERAL_PREVIEW_DEPLOY'
  | 'RC_PREVIEW_REDEPLOY_ON_FIX'
  | 'SAFE_PROVIDER_CALL'
  // ── Genuinely NEW permission — always requires authority ──
  | 'PRODUCTION_DEPLOY'
  | 'MERGE_MAIN'
  | 'DESTRUCTIVE_GIT_FS'
  | 'UNINTENDED_EXTERNAL_SIDE_EFFECT'

/** The set of actions the standing Stage-3C authorization already grants. */
export const STANDING_AUTHORITY_ACTIONS: readonly AuthorityAction[] = [
  'READ_ONLY_RUNTIME_TEST', 'SAFE_RC_INSPECTION', 'NON_MAIN_COMMIT_PUSH',
  'EPHEMERAL_PREVIEW_DEPLOY', 'RC_PREVIEW_REDEPLOY_ON_FIX', 'SAFE_PROVIDER_CALL',
]

/**
 * True iff the action needs a genuinely NEW permission not already granted. Standing
 * actions → false (must NOT emit AUTHORITY_REQUIRED). Production/main/destructive/
 * external-side-effect → true (specificity: real new permission still gates).
 */
export function requiresNewAuthority(action: AuthorityAction): boolean {
  return !STANDING_AUTHORITY_ACTIONS.includes(action)
}

export interface AuthorityClassification {
  action: AuthorityAction
  requiresNew: boolean
  verdict: 'AUTHORITY_REQUIRED' | 'AUTHORITY_CLASSIFICATION_FALSE_POSITIVE' | 'WITHIN_STANDING_AUTHORITY'
  reason: string
}

/**
 * Classify an authority need. If a past decision emitted AUTHORITY_REQUIRED for a
 * standing action, that is recorded as AUTHORITY_CLASSIFICATION_FALSE_POSITIVE.
 */
export function classifyAuthority(action: AuthorityAction, wasEscalatedToAuthorityRequired: boolean): AuthorityClassification {
  const requiresNew = requiresNewAuthority(action)
  if (requiresNew) {
    return { action, requiresNew, verdict: 'AUTHORITY_REQUIRED', reason: `'${action}' is a genuinely new permission not covered by standing authority` }
  }
  return {
    action,
    requiresNew,
    verdict: wasEscalatedToAuthorityRequired ? 'AUTHORITY_CLASSIFICATION_FALSE_POSITIVE' : 'WITHIN_STANDING_AUTHORITY',
    reason: wasEscalatedToAuthorityRequired
      ? `'${action}' is covered by standing Stage-3C authority — escalating it to AUTHORITY_REQUIRED was a false positive`
      : `'${action}' is covered by standing Stage-3C authority — continue without yielding`,
  }
}
