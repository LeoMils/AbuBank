/*
 * presenceState.test.ts — the live session → presence state mapping (STEP 2 wiring).
 * ════════════════════════════════════════════════════════════════════════════
 * Proves all four presence states are reachable from real LiveSession states, so the
 * character's aura + mouth-gating reflect what she is actually doing. CODE evidence
 * (a pure mapping); on-device timing of the thinking window is not claimed here.
 */
import { describe, it, expect } from 'vitest'
import { toPresenceState } from './LiveScreen'

describe('toPresenceState — session state drives the presence', () => {
  it('connecting → thinking', () => {
    expect(toPresenceState('connecting', false)).toBe('thinking')
  })
  it('listening → listening', () => {
    expect(toPresenceState('listening', false)).toBe('listening')
  })
  it('speaking → speaking', () => {
    expect(toPresenceState('speaking', false)).toBe('speaking')
  })
  it('idle / error → waiting (calm)', () => {
    expect(toPresenceState('idle', false)).toBe('waiting')
    expect(toPresenceState('error', false)).toBe('waiting')
  })
  it('the thinking hint (user just finished) shows thinking until she speaks', () => {
    // listening + thinking hint → thinking …
    expect(toPresenceState('listening', true)).toBe('thinking')
    // … but her audio starting (speaking) wins over a stale hint.
    expect(toPresenceState('speaking', true)).toBe('speaking')
  })
})
