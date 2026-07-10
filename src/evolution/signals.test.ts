import { describe, it, expect } from 'vitest'
import { detectAutomatic, detectExplicit, detectImplicit, detectSignals, mayDriveLearning, tokenSimilarity } from './signals'
import { buildEnvelope, type TurnFacts } from './traceEnvelope'

function env(over: Partial<TurnFacts>) {
  return buildEnvelope({ ts: 1_700_000_000_000, sessionId: 's', turnId: 't', input: '', intent: 'calendar_create',
    source: 'deterministic', finalAnswer: '', ...over })
}

describe('automatic signals — Scenario B: claimed a save that never committed', () => {
  it('flags claimed_saved_not_committed as GOLD', () => {
    const e = env({ finalAnswer: 'קבעתי לך פגישה מחר בשלוש', committedStateChanges: [], toolCalls: [] })
    const sigs = detectAutomatic(e)
    const s = sigs.find(x => x.kind === 'claimed_saved_not_committed')
    expect(s).toBeTruthy()
    expect(s!.strength).toBe('gold')
    expect(s!.layerHint).toBe('state_commitment')
  })
  it('does NOT flag when a commit tool actually succeeded', () => {
    const e = env({ finalAnswer: 'קבעתי לך פגישה מחר', toolCalls: [{ toolName: 'calendar_create', status: 'success', result: 'ok' }] })
    expect(detectAutomatic(e).some(x => x.kind === 'claimed_saved_not_committed')).toBe(false)
  })
  it('flags no_info_but_retrieval_returned', () => {
    const e = env({ intent: 'family', finalAnswer: 'לא יודעת מי זה',
      toolCalls: [{ toolName: 'family', status: 'success', result: 'אופיר היא הנכדה' }] })
    expect(detectAutomatic(e).some(x => x.kind === 'no_info_but_retrieval_returned')).toBe(true)
  })
  it('flags an unapproved answer that was still emitted', () => {
    const e = env({ finalAnswer: 'משהו', supervisorApproved: false, supervisorReasons: ['robotic'] })
    expect(detectAutomatic(e).some(x => x.kind === 'unapproved_answer_emitted')).toBe(true)
  })
})

describe('explicit signals — bilingual correction/undo/confirmation', () => {
  it('Hebrew correction on the prior turn is GOLD', () => {
    const prev = env({ turnId: 'p', finalAnswer: 'עילי הוא הבן' })
    const cur = env({ turnId: 'c', input: 'לא נכון, טעית' })
    const s = detectExplicit(prev, cur)
    expect(s.some(x => x.kind === 'user_correction' && x.strength === 'gold')).toBe(true)
    expect(s[0]!.turnId).toBe('p') // judges the PRIOR turn
  })
  it('Spanish correction detected', () => {
    const prev = env({ turnId: 'p', finalAnswer: 'x' })
    const cur = env({ turnId: 'c', input: 'no es así, te equivocaste' })
    expect(detectExplicit(prev, cur).some(x => x.kind === 'user_correction')).toBe(true)
  })
  it('undo after a committed change is GOLD', () => {
    const prev = env({ turnId: 'p', finalAnswer: 'קבעתי', committedStateChanges: [{ id: 1 }] })
    const cur = env({ turnId: 'c', input: 'תבטלי את זה' })
    const s = detectExplicit(prev, cur).find(x => x.kind === 'user_undo')
    expect(s!.strength).toBe('gold')
  })
  it('positive confirmation is a SUCCESS signal', () => {
    const prev = env({ turnId: 'p', finalAnswer: 'x' })
    const cur = env({ turnId: 'c', input: 'מושלם תודה' })
    const s = detectExplicit(prev, cur).find(x => x.kind === 'user_confirmation')
    expect(s!.polarity).toBe('success')
  })
})

describe('implicit signals + strength gating', () => {
  it('detects an immediate repeat', () => {
    const prev = env({ turnId: 'p', input: 'מה יש לי מחר ביומן' })
    const cur = env({ turnId: 'c', input: 'מה יש לי מחר ביומן' })
    expect(detectImplicit(prev, cur).some(x => x.kind === 'immediate_repeat')).toBe(true)
  })
  it('bronze may not drive learning; gold/silver may', () => {
    expect(mayDriveLearning({ strength: 'bronze' } as never)).toBe(false)
    expect(mayDriveLearning({ strength: 'gold' } as never)).toBe(true)
    expect(mayDriveLearning({ strength: 'silver' } as never)).toBe(true)
  })
  it('tokenSimilarity is 1 for identical, low for disjoint', () => {
    expect(tokenSimilarity('אבא של מרתה', 'אבא של מרתה')).toBeCloseTo(1)
    expect(tokenSimilarity('מזג אוויר', 'לוח שנה')).toBeLessThan(0.2)
  })
})

describe('detectSignals over a window', () => {
  it('combines automatic on newest + explicit on predecessor', () => {
    const prev = env({ turnId: 'p', finalAnswer: 'קבעתי לך משהו', committedStateChanges: [] })
    const cur = env({ turnId: 'c', input: 'לא נכון' })
    const sigs = detectSignals([prev, cur])
    expect(sigs.some(s => s.kind === 'user_correction')).toBe(true)
  })
})
