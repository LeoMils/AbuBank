import { describe, it, expect } from 'vitest'
import {
  isRealtimeBetaEnabled, syncRealtimeBetaFromUrl, REALTIME_BETA_KEY,
  isRealtimeSliceEnabled, syncRealtimeSliceFromUrl, REALTIME_SLICE_KEY,
} from './voiceModePreference'

const store = (v: string | null) => ({ getItem: (k: string) => (k === REALTIME_BETA_KEY ? v : null) })

/** Writable storage double capturing setItem for the URL-override tests. */
function rwStore(initial: string | null = null) {
  let val = initial
  return {
    getItem: (k: string) => (k === REALTIME_BETA_KEY ? val : null),
    setItem: (k: string, v: string) => { if (k === REALTIME_BETA_KEY) val = v },
    get value() { return val },
  }
}

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

describe('syncRealtimeBetaFromUrl — enable/disable the beta from a link (no console on iOS PWA)', () => {
  it('?voice=realtime opts in and PERSISTS "1"', () => {
    const s = rwStore(null)
    expect(syncRealtimeBetaFromUrl('?voice=realtime', s)).toBe(true)
    expect(s.value).toBe('1')
    expect(isRealtimeBetaEnabled(s)).toBe(true)
  })
  it('?voice=pipeline opts out and PERSISTS "0"', () => {
    const s = rwStore('1')
    expect(syncRealtimeBetaFromUrl('?voice=pipeline', s)).toBe(false)
    expect(s.value).toBe('0')
    expect(isRealtimeBetaEnabled(s)).toBe(false)
  })
  it('accepts the friendly aliases (beta/on/1 → true, off/0 → false)', () => {
    expect(syncRealtimeBetaFromUrl('?voice=beta', rwStore())).toBe(true)
    expect(syncRealtimeBetaFromUrl('?voice=on', rwStore())).toBe(true)
    expect(syncRealtimeBetaFromUrl('?voice=1', rwStore())).toBe(true)
    expect(syncRealtimeBetaFromUrl('?voice=off', rwStore())).toBe(false)
    expect(syncRealtimeBetaFromUrl('?voice=0', rwStore())).toBe(false)
  })
  it('returns null (no change) when the param is absent or unrecognized', () => {
    const s = rwStore('1')
    expect(syncRealtimeBetaFromUrl('?foo=bar', s)).toBeNull()
    expect(syncRealtimeBetaFromUrl('', s)).toBeNull()
    expect(syncRealtimeBetaFromUrl('?voice=banana', s)).toBeNull()
    expect(s.value).toBe('1') // untouched
  })
  it('never throws on a malformed query', () => {
    expect(syncRealtimeBetaFromUrl('%%%', rwStore())).toBeNull()
  })
})

describe('Realtime SLICE flag (realtime2) — independent, OFF by default', () => {
  const sliceStore = (v: string | null) => ({ getItem: (k: string) => (k === REALTIME_SLICE_KEY ? v : null) })
  function rwSlice(initial: string | null = null) {
    let val = initial
    return {
      getItem: (k: string) => (k === REALTIME_SLICE_KEY ? val : null),
      setItem: (k: string, v: string) => { if (k === REALTIME_SLICE_KEY) val = v },
      get value() { return val },
    }
  }

  it('defaults OFF and enables only on explicit "1"', () => {
    expect(isRealtimeSliceEnabled(sliceStore(null))).toBe(false)
    expect(isRealtimeSliceEnabled(sliceStore('1'))).toBe(true)
  })
  it('?voice=realtime2 / slice opt in and PERSIST "1"', () => {
    const s = rwSlice(null)
    expect(syncRealtimeSliceFromUrl('?voice=realtime2', s)).toBe(true)
    expect(s.value).toBe('1')
    expect(syncRealtimeSliceFromUrl('?voice=slice', rwSlice())).toBe(true)
  })
  it('?voice=pipeline clears the slice too', () => {
    const s = rwSlice('1')
    expect(syncRealtimeSliceFromUrl('?voice=pipeline', s)).toBe(false)
    expect(s.value).toBe('0')
  })
  it('INDEPENDENCE: ?voice=realtime2 does NOT enable the realtime BETA', () => {
    const beta = rwStore(null)
    // The beta sync only recognizes realtime/beta/on/1 — realtime2 is not one of them.
    expect(syncRealtimeBetaFromUrl('?voice=realtime2', beta)).toBeNull()
    expect(beta.value).toBeNull()
  })
  it('INDEPENDENCE: ?voice=realtime does NOT enable the slice', () => {
    const slice = rwSlice(null)
    expect(syncRealtimeSliceFromUrl('?voice=realtime', slice)).toBeNull()
    expect(slice.value).toBeNull()
  })
  it('never throws on a malformed query', () => {
    expect(syncRealtimeSliceFromUrl('%%%', rwSlice())).toBeNull()
  })
})
