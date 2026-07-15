import { describe, it, expect } from 'vitest'
import { isRealtimeBetaEnabled, REALTIME_BETA_KEY } from './voiceModePreference'

const store = (v: string | null) => ({ getItem: (k: string) => (k === REALTIME_BETA_KEY ? v : null) })

describe('voiceModePreference — reliable pipeline is the DEFAULT; Realtime is opt-in beta', () => {
  it('defaults to the pipeline (Realtime OFF) when nothing is set', () => {
    expect(isRealtimeBetaEnabled(store(null))).toBe(false)
  })
  it('enables Realtime only when the beta flag is explicitly "1"', () => {
    expect(isRealtimeBetaEnabled(store('1'))).toBe(true)
    expect(isRealtimeBetaEnabled(store('0'))).toBe(false)
    expect(isRealtimeBetaEnabled(store('true'))).toBe(false)
  })
  it('never throws — a broken storage falls back to the pipeline (false)', () => {
    const broken = { getItem: () => { throw new Error('nope') } }
    expect(isRealtimeBetaEnabled(broken)).toBe(false)
  })
})
