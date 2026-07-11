import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RealtimeVoiceSession } from './realtimeVoice'

/*
 * REALTIME_AUDIO_TIMEOUT watchdog: after speak() sends a response.create asking for
 * audio, if NO output-audio event arrives within the window, classify + cancel +
 * hand off (onAudioTimeout) so the caller voices via pipeline TTS — never silent.
 * The data channel is null here (no WebRTC in a unit test): sendEvent() is a no-op
 * but the watchdog still arms, so the timing logic is fully exercised.
 */
function makeCb(over: Record<string, unknown> = {}) {
  return {
    onStateChange: vi.fn(),
    onUserTranscript: vi.fn(),
    onAssistantTranscript: vi.fn(),
    onAssistantDelta: vi.fn(),
    onError: vi.fn(),
    onAudioTimeout: vi.fn(),
    ...over,
  }
}

describe('REALTIME_AUDIO_TIMEOUT watchdog', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires onAudioTimeout(REALTIME_AUDIO_TIMEOUT) when no audio arrives after speak()', () => {
    const cb = makeCb()
    const s = new RealtimeVoiceSession(cb as never, 'instr')
    s.speak('שלום מרטיטה')
    vi.advanceTimersByTime(5001)
    expect(cb.onAudioTimeout).toHaveBeenCalledTimes(1)
    expect(cb.onAudioTimeout).toHaveBeenCalledWith('REALTIME_AUDIO_TIMEOUT')
  })

  it('an output-audio event clears the watchdog — the happy path never false-times-out', () => {
    const cb = makeCb()
    const s = new RealtimeVoiceSession(cb as never, 'instr') as unknown as { speak: (t: string) => void; handleEvent: (e: unknown) => void }
    s.speak('שלום')
    s.handleEvent({ type: 'response.output_audio.delta', delta: 'x' }) // → assistant_audio_delta clears
    vi.advanceTimersByTime(6000)
    expect(cb.onAudioTimeout).not.toHaveBeenCalled()
  })

  it('interrupt() (barge-in) clears the watchdog — no timeout fires', () => {
    const cb = makeCb()
    const s = new RealtimeVoiceSession(cb as never, 'instr')
    s.speak('שלום')
    s.interrupt()
    vi.advanceTimersByTime(6000)
    expect(cb.onAudioTimeout).not.toHaveBeenCalled()
  })

  it('listen mode is passive — an audio timeout never fires a reply fallback', () => {
    const cb = makeCb()
    const s = new RealtimeVoiceSession(cb as never, 'instr', undefined, 'listen')
    s.speak('שלום')
    vi.advanceTimersByTime(6000)
    expect(cb.onAudioTimeout).not.toHaveBeenCalled()
  })

  it('empty reply does not arm the watchdog', () => {
    const cb = makeCb()
    const s = new RealtimeVoiceSession(cb as never, 'instr')
    s.speak('   ')
    vi.advanceTimersByTime(6000)
    expect(cb.onAudioTimeout).not.toHaveBeenCalled()
  })
})
