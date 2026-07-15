import { describe, it, expect } from 'vitest'
import { isRealtimeBetaEnabled, syncRealtimeBetaFromUrl, REALTIME_BETA_KEY } from './voiceModePreference'

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
