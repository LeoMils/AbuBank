import { describe, it, expect } from 'vitest'
import { createMemoryObserver } from './observer'
import { DEFAULT_EVOLUTION_CONFIG, isBehaviorChangeAllowed } from './config'
import type { TurnFacts } from './traceEnvelope'

function claimedSaveTurn(over: Partial<TurnFacts> = {}): TurnFacts {
  return { ts: 1_700_000_000_000, sessionId: 's1', turnId: 't1', input: 'קבעי לי פגישה מחר',
    intent: 'calendar_create', source: 'deterministic', finalAnswer: 'קבעתי לך פגישה מחר בשלוש',
    committedStateChanges: [], toolCalls: [], modality: 'text', ...over }
}

describe('observer — OBSERVE_ONLY structural guarantee', () => {
  it('is never allowed to change behavior in the default mode', () => {
    expect(isBehaviorChangeAllowed(DEFAULT_EVOLUTION_CONFIG)).toBe(false)
  })
  it('captures a turn, raises a GOLD signal, and opens a case', () => {
    const obs = createMemoryObserver()
    const r = obs.observe(claimedSaveTurn())
    expect(r.captured).toBe(true)
    expect(r.signals.some(s => s.kind === 'claimed_saved_not_committed')).toBe(true)
    expect(r.openedCaseIds.length).toBe(1)
    const c = obs.getCases()[0]!
    expect(c.state).toBe('DUPLICATE_CHECKED') // advanced through the justified early states
    expect(c.history.length).toBeGreaterThanOrEqual(5)
  })
  it('dedupes an identical replayed turn (no duplicate case)', () => {
    const obs = createMemoryObserver()
    obs.observe(claimedSaveTurn())
    const again = obs.observe(claimedSaveTurn())
    expect(again.deduped).toBe(true)
    expect(again.openedCaseIds).toHaveLength(0)
    expect(obs.getCases()).toHaveLength(1)
  })
})

describe('observer — kill switches', () => {
  it('captures nothing when globally disabled', () => {
    const obs = createMemoryObserver({ ...DEFAULT_EVOLUTION_CONFIG, enabled: false })
    expect(obs.observe(claimedSaveTurn()).captured).toBe(false)
  })
  it('respects a per-domain kill switch', () => {
    const obs = createMemoryObserver({ ...DEFAULT_EVOLUTION_CONFIG, domainKill: { calendar: true } })
    expect(obs.observe(claimedSaveTurn()).captured).toBe(false)
  })
})

describe('observer — crash-proof', () => {
  it('never throws on malformed facts', () => {
    const obs = createMemoryObserver()
    // deliberately break the shape
    expect(() => obs.observe({ ...claimedSaveTurn(), ts: NaN, entities: { self: {} } as never })).not.toThrow()
  })
  it('stores only redacted evidence (no raw phone) in the queue', () => {
    const obs = createMemoryObserver()
    obs.observe(claimedSaveTurn({ input: 'תתקשרי ל 052-1234567', finalAnswer: 'בסדר' }))
    const stored = JSON.stringify(obs.getQueue().all())
    expect(stored).not.toContain('052-1234567')
  })
})
