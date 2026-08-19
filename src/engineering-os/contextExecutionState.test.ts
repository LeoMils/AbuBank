/*
 * CONTEXT-EXECUTION adversarial suite (§2). CX1–CX4 + the prior-escape regression.
 */
import { describe, it, expect } from 'vitest'
import { deriveContextState, classifyPastExit } from './contextExecutionState'

describe('context-execution state CX1–CX4', () => {
  it('CX1 · substantial context + machine work → not a hard stop (continue)', () => {
    const r = deriveContextState({ telemetryAvailable: true, usedFraction: 0.5, hardLimitSignal: false, machineWorkRemains: true })
    expect(r.mustStop).toBe(false); expect(r.state).not.toBe('CONTEXT_HARD_STOP')
  })
  it('CX2 · pressure but persistable → checkpoint + continue, not stop', () => {
    const r = deriveContextState({ telemetryAvailable: true, usedFraction: 0.92, hardLimitSignal: false, machineWorkRemains: true })
    expect(r.mustStop).toBe(false); expect(r.state).toBe('CONTEXT_CHECKPOINT_RECOMMENDED')
  })
  it('CX3 · actual hard harness/context failure → CONTEXT_HARD_STOP', () => {
    const r = deriveContextState({ telemetryAvailable: false, hardLimitSignal: true, machineWorkRemains: true })
    expect(r.mustStop).toBe(true); expect(r.state).toBe('CONTEXT_HARD_STOP')
  })
  it('CX4 · merely completed a layer + "context concern", no signal → continue (NOT hard stop)', () => {
    const r = deriveContextState({ telemetryAvailable: false, hardLimitSignal: false, machineWorkRemains: true })
    expect(r.mustStop).toBe(false); expect(r.state).toBe('CONTEXT_CHECKPOINT_RECOMMENDED')
  })
  it('SPECIFICITY · a genuine hard signal is still honored (do not force unsafe continuation)', () => {
    expect(deriveContextState({ telemetryAvailable: true, usedFraction: 0.4, hardLimitSignal: true, machineWorkRemains: true }).mustStop).toBe(true)
  })
})

describe('prior CONTEXT_HARD_STOP was an EXECUTION_CONTROL_ESCAPE (self-audit regression)', () => {
  it('a claimed CONTEXT_HARD_STOP with no hard-limit signal is an escape', () => {
    const e = classifyPastExit('CONTEXT_HARD_STOP', /*hadHardLimitSignal*/ false, 'stage3c-prior-exit')
    expect(e.verdict).toBe('EXECUTION_CONTROL_ESCAPE')
  })
  it('a CONTEXT_HARD_STOP WITH a hard-limit signal is justified', () => {
    expect(classifyPastExit('CONTEXT_HARD_STOP', true, 'x').verdict).toBe('JUSTIFIED')
  })
})
