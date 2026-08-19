/*
 * flags.test.ts — the online capability defaults live in CODE (survive a merge), env is override-only.
 */
import { describe, it, expect } from 'vitest'
import { onlineGeneralSearchEnabled, onlinePrefetchWarmEnabled, ONLINE_GENERAL_SEARCH_DEFAULT } from './flags'

describe('online general search flag', () => {
  it('defaults ON in code (measured never-worse-than-snippet), NOT from a Preview env var', () => {
    expect(ONLINE_GENERAL_SEARCH_DEFAULT).toBe(true)
    expect(onlineGeneralSearchEnabled({})).toBe(true) // no env at all → the code default, not shallow
  })
  it('env is an ops override only (kill-switch / force-on), legacy name accepted', () => {
    expect(onlineGeneralSearchEnabled({ ONLINE_DEEP_FETCH: '0' })).toBe(false)
    expect(onlineGeneralSearchEnabled({ ONLINE_DEEP_FETCH: 'false' })).toBe(false)
    expect(onlineGeneralSearchEnabled({ ONLINE_GENERAL_SEARCH: '1' })).toBe(true)
  })
})

describe('prefetch warm flag', () => {
  it('defaults OFF pending the device freshness-vs-latency measurement; env can force it', () => {
    expect(onlinePrefetchWarmEnabled({})).toBe(false)
    expect(onlinePrefetchWarmEnabled({ LIVE_PREFETCH_WARM: '1' })).toBe(true)
    expect(onlinePrefetchWarmEnabled({ LIVE_PREFETCH_WARM: '0' })).toBe(false)
  })
})
