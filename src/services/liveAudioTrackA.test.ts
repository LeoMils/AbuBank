/*
 * liveAudioTrackA.test.ts — TRACK A audio mechanisms (pure, no WebRTC).
 * The far-field config + the barge-in wire events are the buildable, testable core; the
 * audible result (no echo, clean barge-in) is the owner's ear (AUDIO_CHECK.md). Flags are
 * OFF by default, so these prove the mechanism AND that the default payload is unchanged.
 */
import { describe, it, expect } from 'vitest'
import { buildSessionUpdate, bargeInEvents, LIVE_AUDIO_TUNE_V2, LIVE_BARGE_IN_TRUNCATE } from './liveSession'

const audioInput = (u: Record<string, unknown>) =>
  ((u.session as { audio?: { input?: Record<string, unknown> } }).audio?.input) ?? {}

describe('far-field noise reduction (flag-gated)', () => {
  it('is ABSENT by default so the session payload is unchanged', () => {
    expect(LIVE_AUDIO_TUNE_V2).toBe(false)
    expect(audioInput(buildSessionUpdate(0)).noise_reduction).toBeUndefined()
  })
  it('when enabled, declares far_field noise reduction for the speakerphone', () => {
    const nr = audioInput(buildSessionUpdate(0, { farField: true })).noise_reduction
    expect(nr).toEqual({ type: 'far_field' })
  })
  it('keeps interrupt_response FALSE either way (server never auto-truncates on echo)', () => {
    for (const ff of [false, true]) {
      const td = (audioInput(buildSessionUpdate(0, { farField: ff })).turn_detection) as { interrupt_response?: boolean }
      expect(td.interrupt_response).toBe(false)
    }
  })
})

describe('barge-in wire events (client-side truncate)', () => {
  it('cancels the response THEN truncates the item to the played position', () => {
    expect(bargeInEvents('item_5', 2345.6)).toEqual([
      { type: 'response.cancel' },
      { type: 'conversation.item.truncate', item_id: 'item_5', content_index: 0, audio_end_ms: 2346 },
    ])
  })
  it('clamps a negative played position to 0', () => {
    expect(bargeInEvents('x', -50)[1]).toMatchObject({ audio_end_ms: 0 })
  })
  it('emits nothing when there is no assistant item to truncate', () => {
    expect(bargeInEvents(null, 1000)).toEqual([])
  })
  it('is OFF by default (device echo-regression check required before enabling)', () => {
    expect(LIVE_BARGE_IN_TRUNCATE).toBe(false)
  })
})
