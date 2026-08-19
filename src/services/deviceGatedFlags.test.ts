import { describe, it, expect } from 'vitest'
import {
  DEVICE_GATED_FLAGS,
  assertDeviceGatedFlagIntegrity,
  deviceGatedFlagStartupReport,
  anyDeviceGatedCapabilityDark,
  type DeviceGatedFlag,
} from './deviceGatedFlags'

/*
 * The promotion ledger must FAIL LOUDLY on a silently-dropped device-gated flag
 * (overnight item 1). A comment cannot do this; this test is the enforcement.
 */
describe('device-gated flag promotion ledger', () => {
  it('the real registry is currently INTEGRAL (nothing confirmed-but-dropped)', () => {
    // All flags ship OFF, awaiting the owner ear, promotionConfirmed=false → no throw.
    expect(() => assertDeviceGatedFlagIntegrity()).not.toThrow()
  })

  it('every flag ships OFF and unconfirmed today (the correct pre-ear state)', () => {
    for (const f of DEVICE_GATED_FLAGS) {
      expect(f.promotionConfirmed).toBe(false)
      expect(f.effective).toBe(false) // no VITE_LIVE_* override in the test build
    }
  })

  it('THROWS loudly when a flag is ear-confirmed but still ships OFF (the merge hazard)', () => {
    const dropped: DeviceGatedFlag[] = [{
      id: 'LIVE_AUDIO_TUNE_V2', envVar: 'VITE_LIVE_AUDIO_TUNE_V2',
      capability: 'far-field NR', earCheck: 'AUDIO_CHECK #2',
      effective: false, promotionConfirmed: true, // confirmed but dropped
    }]
    expect(() => assertDeviceGatedFlagIntegrity(dropped)).toThrow(/DROPPED SILENTLY/)
  })

  it('does NOT throw when a confirmed flag is actually ON (promotion done correctly)', () => {
    const promoted: DeviceGatedFlag[] = [{
      id: 'LIVE_AUDIO_TUNE_V2', envVar: 'VITE_LIVE_AUDIO_TUNE_V2',
      capability: 'far-field NR', earCheck: 'AUDIO_CHECK #2',
      effective: true, promotionConfirmed: true,
    }]
    expect(() => assertDeviceGatedFlagIntegrity(promoted)).not.toThrow()
  })

  it('the startup report names each dark capability and its gate (loud, not silent)', () => {
    const lines = deviceGatedFlagStartupReport()
    expect(lines.length).toBe(DEVICE_GATED_FLAGS.length)
    expect(lines.every((l) => l.includes('[device-gated]'))).toBe(true)
    expect(lines.some((l) => l.includes('awaiting owner ear'))).toBe(true)
    expect(anyDeviceGatedCapabilityDark()).toBe(true) // today, yes — all three are dark
  })
})
