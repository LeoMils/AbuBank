import { describe, it, expect } from 'vitest'
import {
  nextVoiceState, isFailureState, timeoutFor, failureLine, listeningNeverSilent,
  FAILURE_STATES, type VoiceState,
} from './voiceStateMachine'

describe('voice state machine — no indefinite silent waiting (§8)', () => {
  it('19. LISTENING can never rest silently — it is bounded and times out to NO_SPEECH', () => {
    expect(listeningNeverSilent()).toBe(true)
    expect(timeoutFor('LISTENING')).toBeGreaterThan(0)
    expect(nextVoiceState('LISTENING', 'timeout')).toBe('NO_SPEECH')
  })
  it('a completed utterance with an empty transcript resolves to an explicit failure, not silence', () => {
    // LISTENING → SPEECH_DETECTED → TRANSCRIBING → (empty) → NO_SPEECH
    let s: VoiceState = 'LISTENING'
    s = nextVoiceState(s, 'speech_started'); expect(s).toBe('SPEECH_DETECTED')
    s = nextVoiceState(s, 'speech_stopped'); expect(s).toBe('TRANSCRIBING')
    s = nextVoiceState(s, 'transcript_empty'); expect(s).toBe('NO_SPEECH')
    expect(failureLine(s)).toBeTruthy()
  })
  it('13/15. Realtime/audio produced but playback blocked → AUDIO_PLAYBACK_FAILED (visible, not silent)', () => {
    let s: VoiceState = 'THINKING'
    s = nextVoiceState(s, 'thinking_done'); expect(s).toBe('SPEAKING')
    s = nextVoiceState(s, 'audio_failed'); expect(s).toBe('AUDIO_PLAYBACK_FAILED')
    expect(failureLine(s)).toContain('כתבתי') // shows the text, reports the voice failure
  })
  it('14. Realtime yields no response after transcription → RESPONSE_FAILED', () => {
    let s: VoiceState = 'THINKING'
    s = nextVoiceState(s, 'response_failed'); expect(s).toBe('RESPONSE_FAILED')
    expect(isFailureState(s)).toBe(true)
  })
  it('16/18. Realtime failure falls back to the pipeline explicitly (no silent fallback)', () => {
    let s: VoiceState = 'LISTENING'
    s = nextVoiceState(s, 'realtime_failed'); expect(s).toBe('REALTIME_FAILED')
    expect(failureLine(s)).toBeTruthy() // the fallback is ANNOUNCED, never silent
    s = nextVoiceState(s, 'fallback'); expect(s).toBe('FALLBACK_ACTIVE')
    s = nextVoiceState(s, 'transcript_ok'); expect(s).toBe('THINKING') // pipeline continues the turn
  })
  it('17. after a Hebrew utterance the fallback keeps processing the turn (no "repeat please")', () => {
    // FALLBACK_ACTIVE resumes the turn directly on a good transcript — never restarts.
    expect(nextVoiceState('FALLBACK_ACTIVE', 'transcript_ok')).toBe('THINKING')
  })
})

describe('voice state machine — structural safety', () => {
  it('every failure state has a plain-Hebrew line and a bounded/exit path', () => {
    for (const s of FAILURE_STATES) {
      expect(failureLine(s)).toBeTruthy()
      // each failure state can exit or recover — never a dead silent end
      const canRecover = nextVoiceState(s, 'enter') !== s || nextVoiceState(s, 'fallback') !== s || nextVoiceState(s, 'exit') === 'IDLE'
      expect(canRecover).toBe(true)
    }
  })
  it('every bounded state times out to a defined next state', () => {
    for (const s of ['REQUESTING_PERMISSION','LISTENING','TRANSCRIBING','THINKING','SPEAKING'] as VoiceState[]) {
      expect(timeoutFor(s)).toBeGreaterThan(0)
      expect(nextVoiceState(s, 'timeout')).not.toBe(s) // timeout never no-ops
    }
  })
  it('undefined edges are no-ops (no illegal jumps)', () => {
    expect(nextVoiceState('IDLE', 'audio_done')).toBe('IDLE')
  })
})
