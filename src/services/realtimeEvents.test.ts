import { describe, it, expect } from 'vitest'
import { normalizeRealtimeEvent, isUserTranscriptEvent, isAssistantAudioEvent } from './realtimeEvents'

describe('Realtime event contract — CURRENT names are the primary path (Defect 2)', () => {
  it('3. current OpenAI output-audio names are handled', () => {
    expect(normalizeRealtimeEvent('response.output_audio.delta')).toMatchObject({ internal: 'assistant_audio_delta', isLegacy: false })
    expect(normalizeRealtimeEvent('response.output_audio.done')).toMatchObject({ internal: 'assistant_audio_done', isLegacy: false })
    expect(normalizeRealtimeEvent('response.output_audio_transcript.delta')).toMatchObject({ internal: 'assistant_transcript_delta', isLegacy: false })
    expect(normalizeRealtimeEvent('response.output_audio_transcript.done')).toMatchObject({ internal: 'assistant_transcript_done', isLegacy: false })
  })
  it('4. legacy names still map but are flagged legacy (not the only path)', () => {
    const legacy = normalizeRealtimeEvent('response.audio.delta')
    expect(legacy.internal).toBe('assistant_audio_delta')
    expect(legacy.isLegacy).toBe(true)
    // The current name maps to the SAME internal event → both supported, current primary.
    expect(normalizeRealtimeEvent('response.output_audio.delta').internal).toBe(legacy.internal)
  })
  it('5. input transcription delta/completed/failed are distinct internal events', () => {
    expect(normalizeRealtimeEvent('conversation.item.input_audio_transcription.delta').internal).toBe('user_transcript_delta')
    expect(normalizeRealtimeEvent('conversation.item.input_audio_transcription.completed').internal).toBe('user_transcript_done')
    expect(normalizeRealtimeEvent('conversation.item.input_audio_transcription.failed').internal).toBe('user_transcript_failed')
  })
  it('handles VAD, response lifecycle, session, error', () => {
    expect(normalizeRealtimeEvent('input_audio_buffer.speech_started').internal).toBe('speech_started')
    expect(normalizeRealtimeEvent('input_audio_buffer.speech_stopped').internal).toBe('speech_stopped')
    expect(normalizeRealtimeEvent('input_audio_buffer.committed').internal).toBe('audio_committed')
    expect(normalizeRealtimeEvent('response.created').internal).toBe('response_created')
    expect(normalizeRealtimeEvent('response.done').internal).toBe('response_done')
    expect(normalizeRealtimeEvent('session.updated').internal).toBe('session_updated')
    expect(normalizeRealtimeEvent('error').internal).toBe('error')
  })
  it('unknown non-benign names are surfaced (never silently ignored)', () => {
    const u = normalizeRealtimeEvent('response.some_new_event.delta')
    expect(u.internal).toBe('unknown')
    expect(u.isBenign).toBe(false)
    // benign lifecycle chatter is classified benign (not noise)
    expect(normalizeRealtimeEvent('response.output_item.added').isBenign).toBe(true)
  })
  it('helpers classify transcript vs audio events', () => {
    expect(isUserTranscriptEvent('user_transcript_done')).toBe(true)
    expect(isAssistantAudioEvent('assistant_audio_delta')).toBe(true)
    expect(isAssistantAudioEvent('user_transcript_done')).toBe(false)
  })
})
