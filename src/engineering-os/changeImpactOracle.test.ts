/*
 * changeImpactOracle.test.ts — change-impact (§19/B4) + oracle-integrity (§20/B5) + negative-proof (§25).
 */
import { describe, it, expect } from 'vitest'
// @ts-expect-error — pure ESM siblings; shared verbatim, no types.
import { changeImpact, evidenceSurvivesChange } from '../../scripts/change-impact-lib.mjs'
// @ts-expect-error
import { oracleRank, calibrationValid, negativeProofComplete, ORACLE_HIERARCHY } from '../../scripts/oracle-discipline-lib.mjs'

describe('change impact → proof cache (§19/B4)', () => {
  it('a runtime change invalidates the affected capability proof', () => {
    expect(evidenceSurvivesChange('stt-tts-roundtrip', ['src/services/voice.ts']).reuse).toBe(false)
  })
  it('a proven-unrelated change may reuse proof', () => {
    expect(evidenceSurvivesChange('whatsapp-message-generation', ['src/services/voice.ts']).reuse).toBe(true)
  })
  it('THE §19 ATTACK: an UNKNOWN changed path widens scope (never silently narrows)', () => {
    const r = evidenceSurvivesChange('whatsapp-message-generation', ['some/weird/new/path.ts'])
    expect(r.reuse).toBe(false)
    expect(changeImpact(['some/weird/new/path.ts']).widen).toBe(true)
  })
})

describe('oracle integrity (§20/B5)', () => {
  it('deterministic authoritative oracle outranks a semantic judge', () => {
    expect(oracleRank('AUTHORITATIVE_DETERMINISTIC')).toBeLessThan(oracleRank('INDEPENDENT_SEMANTIC_JUDGE'))
    expect(ORACLE_HIERARCHY.length).toBe(5)
  })
  it('co-changed detector requires full calibration; missing steps fail', () => {
    expect(calibrationValid({ detectorChangedWithProduct: true, controlledNegativeFailedForRightReason: true, restoredToPass: true, nearNeighbourSpecificity: true, contractMapping: true }).valid).toBe(true)
    expect(calibrationValid({ detectorChangedWithProduct: true, restoredToPass: true }).valid).toBe(false)
  })
})

describe('negative-proof protocol (§25)', () => {
  it('a residual with attempted routes + named remainder + review trigger is complete', () => {
    expect(negativeProofComplete({ machineApproachesAttempted: ['flightrecorder-replay'], exactIrreducibleRemainder: 'the ear', reviewTrigger: 'tts change' }).valid).toBe(true)
  })
  it('a residual with no attempted machine routes is INVALID (device/human is not proof)', () => {
    expect(negativeProofComplete({ exactIrreducibleRemainder: 'x', reviewTrigger: 'y' }).valid).toBe(false)
  })
  it('a residual with no review trigger is INVALID (residuals must not be permanent)', () => {
    expect(negativeProofComplete({ machineApproachesAttempted: ['x'], exactIrreducibleRemainder: 'y' }).valid).toBe(false)
  })
})
