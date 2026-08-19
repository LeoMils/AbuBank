/*
 * Live device-trace harness — proves it REJECTS every device-falsified failure
 * class and PASSES a clean single-authority trace. This harness is what gates the
 * live rows back to PROVEN (a real iPhone trace must pass it).
 */
import { describe, it, expect } from 'vitest'
import { checkDeviceTrace, deviceTracePasses, type DeviceTurnTrace } from './liveTraceHarness'

const SHA = 'a'.repeat(40)
const clean = (over: Partial<DeviceTurnTrace> = {}): DeviceTurnTrace => ({
  sessionId: 's1', turnId: 't1', clientSha: SHA, buildId: '0.178.0-x', runtimeMode: 'REALTIME_ACTIVE',
  talkOwners: ['model'], responseCreateCount: 1, activeSessions: 1, activeRemoteTracks: 1,
  activeOutputStreams: 1, greetingCountThisSession: 1, path: 'realtime_voice', micPermission: 'granted',
  outputStopReason: 'completed', truncatedEarly: false, transcriptRetryLoop: false,
  calendarIntentRoutedToComm: false, unresolvedRelationshipBecamePerson: false, fallbackAndRealtimeOverlap: false, ...over,
})

describe('live trace harness — a clean single-authority trace passes', () => {
  it('zero violations on a well-formed trace', () => {
    expect(checkDeviceTrace(clean())).toEqual([])
    expect(deviceTracePasses(clean())).toBe(true)
  })
})

describe('live trace harness — rejects every device-falsified class', () => {
  const cases: Array<[Partial<DeviceTurnTrace>, string]> = [
    [{ clientSha: 'local' }, 'BUILD_IDENTITY_UNKNOWN'],
    [{ buildId: 'unknown' }, 'BUILD_IDENTITY_UNKNOWN'],
    [{ path: 'unknown' }, 'PATH_UNKNOWN'],
    [{ talkOwners: ['model', 'legacy_brain'] }, 'MULTIPLE_TALK_OWNERS'],
    [{ responseCreateCount: 2 }, 'MULTIPLE_RESPONSES'],
    [{ activeSessions: 2 }, 'MULTIPLE_SESSIONS'],
    [{ activeRemoteTracks: 2 }, 'MULTIPLE_REMOTE_TRACKS'],
    [{ activeOutputStreams: 2 }, 'MULTIPLE_OUTPUT_STREAMS'],
    [{ greetingCountThisSession: 2 }, 'MULTIPLE_GREETINGS'],
    [{ truncatedEarly: true, outputStopReason: null }, 'OUTPUT_TRUNCATED'],
    [{ transcriptRetryLoop: true }, 'STT_RETRY_LOOP'],
    [{ calendarIntentRoutedToComm: true }, 'CAL_INTENT_TO_COMM'],
    [{ unresolvedRelationshipBecamePerson: true }, 'UNRESOLVED_BECAME_PERSON'],
    [{ fallbackAndRealtimeOverlap: true }, 'FALLBACK_REALTIME_OVERLAP'],
    [{ talkOwners: ['legacy_brain'] }, 'WRONG_TALK_OWNER'],
  ]
  it('each device failure produces its violation code', () => {
    for (const [over, code] of cases) {
      const codes = checkDeviceTrace(clean(over)).map((x) => x.code)
      expect(codes, JSON.stringify(over)).toContain(code)
      expect(deviceTracePasses(clean(over))).toBe(false)
    }
  })
})
