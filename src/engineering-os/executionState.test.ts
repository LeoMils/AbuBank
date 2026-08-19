/*
 * EXECUTION-CONTINUITY adversarial suite (Stage 3C §2). EC1–EC6 spec-derived.
 * The point: a BLOCKED/NO_GO release must NOT let the agent stop while machine work
 * remains — and specificity: a genuine authority/product/context boundary must still
 * be honored (do not force execution through a real boundary).
 */
import { describe, it, expect } from 'vitest'
import { deriveExecutionState, type ExecutionStateInput } from './executionState'

const base: ExecutionStateInput = {
  releaseVerdict: 'BLOCKED', machineClosableWorkRemains: false, allStage3ExitCriteriaMet: false,
}

describe('execution-continuity gate EC1–EC6', () => {
  it('EC1 · BLOCKED + machine-closable control work → CONTINUE_MACHINE_WORK', () => {
    expect(deriveExecutionState({ ...base, releaseVerdict: 'BLOCKED', machineClosableWorkRemains: true }).state).toBe('CONTINUE_MACHINE_WORK')
  })
  it('EC2 · NO_GO + mechanically repairable defect → CONTINUE_MACHINE_WORK', () => {
    expect(deriveExecutionState({ ...base, releaseVerdict: 'NO_GO', machineClosableWorkRemains: true }).state).toBe('CONTINUE_MACHINE_WORK')
  })
  it('EC3 · no machine work + real missing deploy permission → AUTHORITY_REQUIRED', () => {
    expect(deriveExecutionState({ ...base, machineClosableWorkRemains: false, authorityBoundary: { required: true, exactNeed: 'deploy approval' } }).state).toBe('AUTHORITY_REQUIRED')
  })
  it('EC4 · no machine work + legitimate product-policy choice → PRODUCT_DECISION_REQUIRED', () => {
    expect(deriveExecutionState({ ...base, machineClosableWorkRemains: false, productDecision: { required: true, choice: 'memorial tone policy' } }).state).toBe('PRODUCT_DECISION_REQUIRED')
  })
  it('EC5 · all exit criteria + GO → ELIGIBLE_FOR_STAGE4', () => {
    expect(deriveExecutionState({ ...base, releaseVerdict: 'GO', allStage3ExitCriteriaMet: true }).state).toBe('ELIGIBLE_FOR_STAGE4')
  })
  it('EC6 · no machine work + real context hard limit → CONTEXT_HARD_STOP', () => {
    expect(deriveExecutionState({ ...base, machineClosableWorkRemains: false, contextHardStop: true }).state).toBe('CONTEXT_HARD_STOP')
  })
  it('SPECIFICITY · machine work present OVERRIDES an authority boundary (difficulty≠authority)', () => {
    // Work remaining must win — a real boundary only ends execution once work is exhausted.
    expect(deriveExecutionState({ ...base, machineClosableWorkRemains: true, authorityBoundary: { required: true, exactNeed: 'x' } }).state).toBe('CONTINUE_MACHINE_WORK')
  })
  it('SPECIFICITY · all-criteria-met but release not GO does NOT emit ELIGIBLE_FOR_STAGE4', () => {
    expect(deriveExecutionState({ ...base, releaseVerdict: 'BLOCKED', allStage3ExitCriteriaMet: true, machineClosableWorkRemains: false, contextHardStop: true }).state).not.toBe('ELIGIBLE_FOR_STAGE4')
  })
})
