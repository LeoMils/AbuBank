/*
 * preambleGate.test.ts — the client-commit-window decision core (pure; no audio, no WebRTC).
 * Proves: a preamble (audio then a function_call inside the window) is SUPPRESSED; a plain answer
 * (audio, window elapses, no tool call) PLAYS after exactly the window; a tool call AFTER real
 * speech does NOT retro-mute the answer.
 */
import { describe, it, expect } from 'vitest'
import { PreambleGate, DEFAULT_PREAMBLE_WINDOW_MS } from './preambleGate'

describe('PreambleGate — client commit window', () => {
  it('SUPPRESSES a preamble: audio, then a function_call inside the window', () => {
    const g = new PreambleGate(400)
    g.onResponseCreated()
    expect(g.onAudioDelta(1000)).toBe('hold')     // buffering, not playing yet
    expect(g.tick(1200)).toBe('hold')             // 200ms < 400ms window → still holding
    expect(g.onFunctionCall()).toBe('suppress')   // tool call arrived → it was a preamble
    expect(g.tick(1500)).toBe('suppress')         // stays suppressed even past the window
    expect(g.phase).toBe('suppressed')
  })

  it('PLAYS a plain answer: audio, window elapses with no tool call', () => {
    const g = new PreambleGate(400)
    g.onResponseCreated()
    expect(g.onAudioDelta(1000)).toBe('hold')
    expect(g.tick(1399)).toBe('hold')             // just under the window
    expect(g.tick(1400)).toBe('play')             // window elapsed → release exactly at +400ms
    expect(g.phase).toBe('playing')
  })

  it('a function_call AFTER real speech has been released does NOT retro-mute the answer', () => {
    const g = new PreambleGate(400)
    g.onResponseCreated()
    g.onAudioDelta(1000)
    expect(g.tick(1400)).toBe('play')             // answer is playing
    expect(g.onFunctionCall()).toBe('play')       // a later tool call must not mute a live answer
    expect(g.phase).toBe('playing')
  })

  it('measured latency cost: a plain answer is delayed by exactly the window; a suppressed turn 0', () => {
    const g = new PreambleGate(DEFAULT_PREAMBLE_WINDOW_MS)
    g.onResponseCreated()
    g.onAudioDelta(0)
    expect(g.tick(DEFAULT_PREAMBLE_WINDOW_MS - 1)).toBe('hold')
    expect(g.tick(DEFAULT_PREAMBLE_WINDOW_MS)).toBe('play') // +400ms to first heard word of a plain answer
    // a tool turn: suppressed → the grounded answer is a SEPARATE later response, not delayed here
    const t = new PreambleGate()
    t.onResponseCreated(); t.onAudioDelta(0); expect(t.onFunctionCall()).toBe('suppress')
  })

  it('resets cleanly between responses', () => {
    const g = new PreambleGate(400)
    g.onResponseCreated(); g.onAudioDelta(0); g.onFunctionCall(); expect(g.phase).toBe('suppressed')
    g.onResponseDone(); expect(g.phase).toBe('idle')
    g.onResponseCreated(); expect(g.onAudioDelta(10)).toBe('hold') // next response starts fresh
  })
})
