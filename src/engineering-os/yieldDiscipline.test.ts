/*
 * yieldDiscipline.test.ts — regression for the premature-yield escape (ce-premature-yield / §9/C9).
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * Encodes the exact incident: a yield at ctx≈38% citing NEAR_HARD_CONTEXT after the tool error was
 * already worked around is INVALID. A genuine hard boundary is VALID.
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM sibling; shared verbatim, no types.
import { isYieldValid, VALID_HARD_BOUNDARY_CODES } from '../../scripts/yield-discipline-lib.mjs'

describe('yield discipline (§9/C9)', () => {
  it('THE ce-premature-yield incident: NEAR_HARD_CONTEXT at high ctx with a worked-around tool error → INVALID', () => {
    const r = isYieldValid({
      reasonCode: 'NEAR_HARD_CONTEXT_LIMIT_WITH_MEASURED_SIGNAL',
      machineWorkRemaining: 27,
      contextStopEvidence: 'four prompt repetitions and starting more work may produce shallow stubs; Git Bash fork error',
      measuredContextSignal: false,
      toolErrorWorkedAround: true,
    })
    expect(r.valid).toBe(false)
    expect(r.reasons.join(' ')).toMatch(/measured context signal|shallow stub/)
  })

  it('a quality-hedge justification ("large program") is never sufficient', () => {
    const r = isYieldValid({ reasonCode: 'HARD_CONTEXT_LIMIT', machineWorkRemaining: 5, contextStopEvidence: 'this is a large program', measuredContextSignal: true })
    expect(r.valid).toBe(false)
  })

  it('a worked-around tool failure is not a hard failure', () => {
    const r = isYieldValid({ reasonCode: 'TOOL_EXECUTION_HARD_FAILURE', machineWorkRemaining: 3, contextStopEvidence: 'git bash forked', toolErrorWorkedAround: true })
    expect(r.valid).toBe(false)
  })

  it('a GENUINE hard boundary (real measured context signal, no workaround) is VALID', () => {
    const r = isYieldValid({ reasonCode: 'NEAR_HARD_CONTEXT_LIMIT_WITH_MEASURED_SIGNAL', machineWorkRemaining: 3, contextStopEvidence: 'context window at 96% per the UI meter; compaction imminent', measuredContextSignal: true })
    expect(r.valid).toBe(true)
  })

  it('a genuine external permission boundary is VALID', () => {
    const r = isYieldValid({ reasonCode: 'EXTERNAL_PERMISSION_BOUNDARY', machineWorkRemaining: 2, contextStopEvidence: 'gh unauthenticated; no CI-dispatch tool' })
    expect(r.valid).toBe(true)
  })

  it('no machine work remaining → any yield is valid', () => {
    expect(isYieldValid({ machineWorkRemaining: 0 }).valid).toBe(true)
  })

  it('the valid hard-boundary code set matches the constitution (7 codes)', () => {
    expect(VALID_HARD_BOUNDARY_CODES.size).toBe(7)
  })
})
