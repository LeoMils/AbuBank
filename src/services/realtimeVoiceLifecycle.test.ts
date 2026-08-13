/*
 * O-LIFECYCLE — WIRING test: sessionLifecycle driven by the REAL RealtimeVoiceSession.
 * ═══════════════════════════════════════════════════════════════════════════════════
 * The policy math is proven in sessionLifecycle.test.ts. This proves the WIRING: the
 * session's clocks feed lifecycleDecision, effects flow through the real send/handleEvent
 * path (via injectForTest), user activity resets the clocks, and the warm goodbye closes
 * only AFTER it finishes — and NEVER mid-task. No WebRTC, deterministic injected clock.
 */
import { describe, it, expect, vi } from 'vitest'
import { RealtimeVoiceSession } from './realtimeVoice'
import { LIFECYCLE } from './sessionLifecycle'

function harness() {
  const sent: Array<Record<string, unknown>> = []
  const cb = {
    onStateChange: vi.fn(), onUserTranscript: vi.fn(), onAssistantTranscript: vi.fn(),
    onAssistantDelta: vi.fn(), onError: vi.fn(),
  }
  const session = new RealtimeVoiceSession(cb as never, 'instructions')
  let now = 0
  const t = session.injectForTest((e) => sent.push(e), () => now)
  t.startLifecycle()
  const setNow = (ms: number) => { now = ms }
  const lastResponseInstr = () => {
    for (let i = sent.length - 1; i >= 0; i--) {
      const e = sent[i]!
      if (e.type === 'response.create') return ((e.response as { instructions?: string })?.instructions) ?? ''
    }
    return null
  }
  return { session, sent, cb, t, setNow, lastResponseInstr }
}

describe('O-LIFECYCLE wiring — realtime session', () => {
  it('~12s silence → pauses the upstream mic (cost), no spoken line', () => {
    const h = harness()
    h.setNow(LIFECYCLE.STOP_UPSTREAM_MS)
    h.t.tickLifecycle()
    expect(h.t.isUpstreamPaused()).toBe(true)
    expect(h.sent.some((e) => e.type === 'response.create')).toBe(false)
  })

  it('~25s silence → asks once warmly (response.create with "את שם"), only once', () => {
    const h = harness()
    h.setNow(LIFECYCLE.ASK_PRESENCE_MS)
    h.t.tickLifecycle()
    expect(h.lastResponseInstr()).toContain('את שם')
    const count1 = h.sent.filter((e) => e.type === 'response.create').length
    h.setNow(LIFECYCLE.ASK_PRESENCE_MS + 3_000)
    h.t.tickLifecycle()
    expect(h.sent.filter((e) => e.type === 'response.create').length).toBe(count1) // asked ONCE
  })

  it('~45s silence → warm goodbye is spoken, and the session closes AFTER it finishes', () => {
    const h = harness()
    const disconnect = vi.spyOn(h.session, 'disconnect')
    h.setNow(LIFECYCLE.GOODBYE_MS)
    h.t.tickLifecycle()
    expect(h.sent.some((e) => e.type === 'response.create')).toBe(true) // goodbye spoken
    expect(disconnect).not.toHaveBeenCalled()                          // not closed yet
    h.t.receive({ type: 'response.done' })                              // goodbye finished
    expect(disconnect).toHaveBeenCalledTimes(1)                        // now closed
  })

  it('NEVER acts mid-task: mid-response at 60s → no goodbye, no close', () => {
    const h = harness()
    const disconnect = vi.spyOn(h.session, 'disconnect')
    h.t.setResponseActiveForTest(true)
    h.setNow(60_000)
    h.t.tickLifecycle()
    expect(h.sent.some((e) => e.type === 'response.create')).toBe(false)
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('user activity (speech_started) resets the idle clocks and resumes upstream', () => {
    const h = harness()
    h.setNow(LIFECYCLE.STOP_UPSTREAM_MS)
    h.t.tickLifecycle()
    expect(h.t.isUpstreamPaused()).toBe(true)
    h.setNow(LIFECYCLE.STOP_UPSTREAM_MS + 1_000)
    h.t.receive({ type: 'input_audio_buffer.speech_started' }) // she speaks again
    expect(h.t.isUpstreamPaused()).toBe(false)                 // upstream resumed
    h.t.tickLifecycle()                                        // silence now ~0
    expect(h.sent.some((e) => e.type === 'response.create')).toBe(false)
  })
})
