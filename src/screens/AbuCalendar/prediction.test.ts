import { describe, it, expect, beforeEach, vi } from 'vitest'
import { recordAction, getPatternPrediction } from './abuTimeMemory'

describe('pattern prediction', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => { storage[key] = val },
      removeItem: (key: string) => { delete storage[key] },
    })
  })

  it('returns null with fewer than 2 entries', () => {
    recordAction('prepare_list', 'medical')
    expect(getPatternPrediction('medical')).toBeNull()
  })

  it('returns prediction after 2+ consistent actions', () => {
    recordAction('prepare_list', 'medical')
    recordAction('prepare_list', 'medical')
    const prediction = getPatternPrediction('medical')
    expect(prediction).not.toBeNull()
    expect(prediction).toContain('רשימה')
  })

  it('returns null when actions are mixed (low confidence)', () => {
    recordAction('prepare_list', 'medical')
    recordAction('log_outcome', 'medical')
    recordAction('set_reminder', 'medical')
    expect(getPatternPrediction('medical')).toBeNull()
  })

  it('predicts log_outcome for medical after consistent usage', () => {
    recordAction('log_outcome', 'medical')
    recordAction('log_outcome', 'medical')
    recordAction('log_outcome', 'medical')
    const prediction = getPatternPrediction('medical')
    expect(prediction).toContain('רשמת')
  })

  it('predicts notify for social after consistent usage', () => {
    recordAction('notify_contact', 'social')
    recordAction('notify_contact', 'social')
    const prediction = getPatternPrediction('social')
    expect(prediction).toContain('הודעת')
  })

  it('does not cross-predict between event types', () => {
    recordAction('prepare_list', 'medical')
    recordAction('prepare_list', 'medical')
    expect(getPatternPrediction('social')).toBeNull()
  })

  it('caps behavior log at 50 entries', () => {
    for (let i = 0; i < 60; i++) recordAction('prepare_list', 'medical')
    const raw = JSON.parse(storage['abutime-memory']!)
    expect(raw.behaviorLog.length).toBeLessThanOrEqual(50)
  })
})
