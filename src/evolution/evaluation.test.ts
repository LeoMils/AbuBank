import { describe, it, expect } from 'vitest'
import { evaluate, detectHoldoutContamination, type EvalCase, type Behavior, type Grader } from './evaluation'

const corpus: EvalCase[] = [
  { caseId: 'fix1', partition: 'dev', domain: 'family', input: 'ofir?', polarity: 'must_fix' },
  { caseId: 'keep1', partition: 'frozen', domain: 'calendar', input: 'tomorrow?', polarity: 'must_preserve' },
]
const grader: Grader = (_c, out) => ({ pass: out === 'good' })

describe('Scenario G — candidate fixes one case but regresses another → REJECT', () => {
  it('the preservation/holdout gate rejects collateral damage', () => {
    const baseline: Behavior = i => (i === 'ofir?' ? 'bad' : 'good')  // fails the target, keeps control
    const candidate: Behavior = i => (i === 'ofir?' ? 'good' : 'bad') // fixes target, BREAKS control
    const r = evaluate(corpus, baseline, candidate, grader)
    expect(r.fixed).toContain('fix1')
    expect(r.regressed).toContain('keep1')
    expect(r.recommendation).toBe('REJECT')
    expect(r.rejectReasons.join(' ')).toMatch(/holdout|control/)
  })
  it('advances when it fixes the target and preserves everything', () => {
    const baseline: Behavior = i => (i === 'ofir?' ? 'bad' : 'good')
    const candidate: Behavior = () => 'good'
    const r = evaluate(corpus, baseline, candidate, grader)
    expect(r.recommendation).toBe('ADVANCE')
  })
  it('NO_SAFE_WINNER when nothing improves and nothing breaks', () => {
    const same: Behavior = i => (i === 'ofir?' ? 'bad' : 'good')
    const r = evaluate(corpus, same, same, grader)
    expect(r.recommendation).toBe('NO_SAFE_WINNER')
  })
})

describe('P0 invariants are zero-tolerance (never averaged away)', () => {
  it('a single P0 violation rejects even a mostly-improving candidate', () => {
    const baseline: Behavior = () => 'bad'
    const candidate: Behavior = () => 'good'
    const p0Grader: Grader = (c, out) => c.caseId === 'keep1' ? { pass: true, p0Violation: 'cross_user_leak' } : { pass: out === 'good' }
    const r = evaluate(corpus, baseline, candidate, p0Grader)
    expect(r.p0Violations).toHaveLength(1)
    expect(r.recommendation).toBe('REJECT')
  })
})

describe('holdout integrity', () => {
  it('detects a paraphrase leak between generator inputs and a holdout', () => {
    const holdout: EvalCase[] = [{ caseId: 'h1', partition: 'frozen', domain: 'x', input: 'Who is Ofir?', polarity: 'must_fix' }]
    const contaminated = detectHoldoutContamination(['who is ofir'], holdout)
    expect(contaminated).toContain('h1')
    expect(detectHoldoutContamination(['weather in tokyo'], holdout)).toHaveLength(0)
  })
})
