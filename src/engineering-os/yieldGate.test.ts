/*
 * YIELD-GATE adversarial suite (Stage 3C §1). YG1–YG5 are spec-derived.
 * Sensitivity: CONTINUE_MACHINE_WORK + executable next step → yield DENIED.
 * Specificity: a genuine authority/product/evidenced-hard-stop boundary → yield ALLOWED.
 * Non-vacuity: a self-declared (unevidenced) hard stop does NOT unlock a yield.
 */
import { describe, it, expect } from 'vitest'
import { deriveYieldDecision, classifyPastYield, type YieldGateInput } from './yieldGate'

const cont: YieldGateInput = {
  executionState: 'CONTINUE_MACHINE_WORK',
  machineExecutableNextActionExists: true,
}

describe('yield-gate YG1–YG5', () => {
  it('YG1 · CONTINUE_MACHINE_WORK + executable next step → yield DENIED', () => {
    const r = deriveYieldDecision(cont)
    expect(r.mayYield).toBe(false)
  })

  it('YG2 · checkpoint written + executable work remains → yield DENIED', () => {
    const r = deriveYieldDecision({ ...cont, checkpointPersisted: true })
    expect(r.mayYield).toBe(false)
    expect(r.reason).toMatch(/checkpoint/i)
  })

  it('YG3 · coherent layer completed + next layer executable → yield DENIED', () => {
    // "a coherent subtask finished" is modeled as: still CONTINUE, next action exists.
    const r = deriveYieldDecision({ ...cont, machineExecutableNextActionExists: true })
    expect(r.mayYield).toBe(false)
  })

  it('YG4 · genuine external authority required → yield ALLOWED', () => {
    const r = deriveYieldDecision({
      ...cont,
      boundary: { kind: 'AUTHORITY', detail: 'production deploy approval' },
    })
    expect(r.mayYield).toBe(true)
    expect(r.yieldState).toBe('AUTHORITY_REQUIRED')
  })

  it('YG5 · genuine hard tool/context limit (evidenced) → yield ALLOWED', () => {
    const ctx = deriveYieldDecision({
      ...cont,
      boundary: { kind: 'CONTEXT_HARD_STOP', machineObservableEvidence: true, detail: 'harness context exhausted' },
    })
    expect(ctx.mayYield).toBe(true)
    expect(ctx.yieldState).toBe('CONTEXT_HARD_STOP')

    const tool = deriveYieldDecision({
      ...cont,
      boundary: { kind: 'TOOL_HARD_STOP', machineObservableEvidence: true, detail: 'required tool unavailable' },
    })
    expect(tool.mayYield).toBe(true)
    expect(tool.yieldState).toBe('TOOL_HARD_STOP')
  })
})

describe('yield-gate specificity + non-vacuity', () => {
  it('SPECIFICITY · ELIGIBLE_FOR_STAGE4 is a valid terminal yield', () => {
    const r = deriveYieldDecision({ executionState: 'ELIGIBLE_FOR_STAGE4', machineExecutableNextActionExists: false })
    expect(r.mayYield).toBe(true)
    expect(r.yieldState).toBe('ELIGIBLE_FOR_STAGE4')
  })

  it('SPECIFICITY · a genuine PRODUCT_DECISION boundary yields even with work pending', () => {
    const r = deriveYieldDecision({
      ...cont,
      boundary: { kind: 'PRODUCT_DECISION', detail: 'memorial tone policy is a human choice' },
    })
    expect(r.mayYield).toBe(true)
    expect(r.yieldState).toBe('PRODUCT_DECISION_REQUIRED')
  })

  it('NON-VACUITY · a CONTEXT hard stop WITHOUT machine-observable evidence does NOT yield', () => {
    const r = deriveYieldDecision({
      ...cont,
      boundary: { kind: 'CONTEXT_HARD_STOP', machineObservableEvidence: false, detail: 'I feel low on context' },
    })
    expect(r.mayYield).toBe(false)
    expect(r.reason).toMatch(/escape|WITHOUT/i)
  })

  it('NON-VACUITY · a TOOL hard stop WITHOUT evidence does NOT yield', () => {
    const r = deriveYieldDecision({
      ...cont,
      boundary: { kind: 'TOOL_HARD_STOP', machineObservableEvidence: false, detail: 'maybe a tool is missing' },
    })
    expect(r.mayYield).toBe(false)
  })

  it('NON-VACUITY · gate is not always-deny: a real boundary still unlocks a yield', () => {
    // If the gate denied unconditionally it would be vacuous. YG4/YG5/terminal prove not.
    const allowed = deriveYieldDecision({ ...cont, boundary: { kind: 'AUTHORITY', detail: 'x' } })
    const denied = deriveYieldDecision(cont)
    expect(allowed.mayYield).toBe(true)
    expect(denied.mayYield).toBe(false)
  })
})

describe('yield-control escape regression (the prior "CONTINUE then yield")', () => {
  it('records CONTINUE_MACHINE_WORK + work remained + no boundary as YIELD_CONTROL_ESCAPE', () => {
    const e = classifyPastYield('CONTINUE_MACHINE_WORK', true, false, 'prev-session-continue-then-yield')
    expect(e.verdict).toBe('YIELD_CONTROL_ESCAPE')
  })

  it('does NOT flag a yield backed by a genuine boundary', () => {
    const e = classifyPastYield('AUTHORITY_REQUIRED', false, true, 'legit-authority-yield')
    expect(e.verdict).toBe('JUSTIFIED_YIELD')
  })

  it('does NOT flag a yield when no machine work remained', () => {
    const e = classifyPastYield('CONTINUE_MACHINE_WORK', false, false, 'no-work-left')
    expect(e.verdict).toBe('JUSTIFIED_YIELD')
  })
})
