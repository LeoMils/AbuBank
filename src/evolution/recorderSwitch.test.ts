/*
 * Flight Recorder off switch — contract + live suppression at the serving seam.
 * RED-first: proves observeTurn HONORS the user switch (no capture when off).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isRecorderOff, setRecorderOff, RECORDER_OFF_KEY } from './recorderSwitch'
import { observeTurn } from './observer'
import { getObserver } from './observer'
import type { TurnFacts } from './traceEnvelope'

let store: Record<string, string> = {}
beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
  })
})

const facts = (n: number): TurnFacts => ({
  ts: 1_000 + n, sessionId: 'sw-test', turnId: `sw-${n}`,
  input: `שלום ${n}`, intent: 'chitchat', source: 'deterministic', finalAnswer: 'שלום.',
})

describe('recorderSwitch — contract', () => {
  it('defaults to ON (not off), round-trips the persisted flag', () => {
    expect(isRecorderOff()).toBe(false)
    setRecorderOff(true)
    expect(store[RECORDER_OFF_KEY]).toBe('1')
    expect(isRecorderOff()).toBe(true)
    setRecorderOff(false)
    expect(isRecorderOff()).toBe(false)
  })

  it('is crash-proof when storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('nope') }, setItem: () => { throw new Error('nope') }, removeItem: () => { throw new Error('nope') } })
    expect(isRecorderOff()).toBe(false)
    expect(() => setRecorderOff(true)).not.toThrow()
  })
})

describe('observeTurn — honors the user off switch (live suppression)', () => {
  it('captures when ON, and does NOT capture when OFF', () => {
    const q = getObserver().getQueue()
    // ON (default): a fresh turn is captured (queue grows by 1).
    const before = q.all().length
    observeTurn(facts(1))
    expect(q.all().length).toBe(before + 1)
    // OFF: the next turn is NOT captured (queue length unchanged).
    setRecorderOff(true)
    const mid = q.all().length
    observeTurn(facts(2))
    expect(q.all().length).toBe(mid)
    // Back ON: capture resumes.
    setRecorderOff(false)
    observeTurn(facts(3))
    expect(q.all().length).toBe(mid + 1)
  })
})
