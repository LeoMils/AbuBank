/*
 * ResponseLifecycle — explicit response/audio state machine. Each test maps to a
 * device-recreating hole the boolean lease had (§1 premature release, §2 reset on
 * input, §3 text dedup, §5 explicit terminal, §6 interruption drain).
 */
import { describe, it, expect } from 'vitest'
import { ResponseLifecycle } from './responseLifecycle'

function started(): ResponseLifecycle {
  const l = new ResponseLifecycle()
  expect(l.onAcceptedInput('item_1', 0).kind).toBe('new_turn')
  expect(l.requestResponseStart('AUTO_MODEL_RESPONSE').granted).toBe(true)
  l.onResponseCreated('resp_1'); l.onAudioStarted()
  return l
}

describe('§1 transcript-done is NOT terminal; a second response is blocked while audio plays', () => {
  it('after transcript-done with audio PLAYING, a new response is rejected', () => {
    const l = started()
    l.onTranscriptDone()                                  // text done — NOT audible completion
    expect(l.audio).toBe('PLAYING')
    expect(l.canStartNewResponse()).toBe(false)
    expect(l.requestResponseStart('TRUTH_REPAIR_RESPONSE').granted).toBe(false)  // overlap prevented
  })
  it('only response-done (audio stopped) permits the next response', () => {
    const l = started(); l.onTranscriptDone()
    expect(l.onResponseDone('resp_1')).toBe(true)
    expect(l.audio).toBe('STOPPED'); expect(l.canStartNewResponse()).toBe(true)
    expect(l.requestResponseStart('TRUTH_REPAIR_RESPONSE').granted).toBe(true)   // sequential repair OK
  })
})

describe('§2 new input during output is an INTERRUPTION, not a lease reset', () => {
  it('a new item id while ACTIVE → interruption; no new response until cancel+drain', () => {
    const l = started()
    expect(l.onAcceptedInput('item_2', 0).kind).toBe('interruption')
    expect(l.requestResponseStart('AUTO_MODEL_RESPONSE').granted).toBe(false)    // no parallel response
    l.beginCancel(); expect(l.response).toBe('CANCELLING'); expect(l.audio).toBe('DRAINING')
    l.onAudioStopped(); expect(l.response).toBe('COMPLETED'); expect(l.audio).toBe('STOPPED')
    expect(l.requestResponseStart('AUTO_MODEL_RESPONSE').granted).toBe(true)     // exactly one after drain
  })
})

describe('§3 turn identity is the provider item id, never transcript text', () => {
  it('same item id → duplicate; a terminal turn + a different item id → new turn', () => {
    const l = new ResponseLifecycle()
    expect(l.onAcceptedInput('A', 0).kind).toBe('new_turn')
    expect(l.onAcceptedInput('A', 0).kind).toBe('duplicate')      // same item, multiple event shapes
    l.requestResponseStart('AUTO_MODEL_RESPONSE'); l.onResponseCreated('r'); l.onResponseDone('r')
    expect(l.onAcceptedInput('B', 0).kind).toBe('new_turn')       // different item id (identical text would still be new)
  })
  it('a stale generation input is rejected as duplicate', () => {
    const l = new ResponseLifecycle()
    expect(l.onAcceptedInput('X', 1).kind).toBe('duplicate')      // generation 1 != current 0
  })
})

describe('§5 terminal events for the WRONG response id are rejected', () => {
  it('a response-done naming a different id does not terminate the active response', () => {
    const l = started()
    expect(l.onResponseDone('resp_OTHER')).toBe(false)            // wrong id ignored
    expect(l.response).toBe('ACTIVE')
    expect(l.onResponseDone('resp_1')).toBe(true)
  })
})
