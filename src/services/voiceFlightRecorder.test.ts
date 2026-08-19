import { describe, it, expect } from 'vitest'
import { VoiceFlightRecorder, VOICE_STAGES } from './voiceFlightRecorder'

describe('Voice Flight Recorder — first missing stage is identifiable (§ recorder, test #14)', () => {
  it('records all 29 stages and starts pending', () => {
    const r = new VoiceFlightRecorder('t1', 0)
    expect(VOICE_STAGES.length).toBe(29)
    expect(r.snapshot().stages.every(s => s.status === 'pending')).toBe(true)
  })
  it('identifies the first missing stage where the turn stalled', () => {
    const r = new VoiceFlightRecorder('t1', 0)
    r.mark('USER_GESTURE_RECEIVED', 'ok', 1)
    r.mark('SECURE_CONTEXT', 'ok', 2)
    r.mark('MICROPHONE_PERMISSION_REQUESTED', 'ok', 3)
    r.mark('MICROPHONE_PERMISSION_GRANTED', 'ok', 4)
    r.mark('MEDIA_STREAM_CREATED', 'ok', 5)
    // stalls here — AUDIO_TRACK_LIVE never marked
    const snap = r.snapshot()
    expect(snap.firstMissing).toBe('AUDIO_TRACK_LIVE')
    expect(snap.reachedSpeech).toBe(false)
  })
  it('surfaces the first failure with its error code', () => {
    const r = new VoiceFlightRecorder('t1', 0)
    r.mark('USER_GESTURE_RECEIVED', 'ok', 1)
    r.mark('AUDIO_TRACK_LIVE', 'fail', 2, { errorCode: 'track_ended' })
    expect(r.firstFailure()).toEqual({ stage: 'AUDIO_TRACK_LIVE', errorCode: 'track_ended' })
  })
})

describe('Voice Flight Recorder — privacy + report', () => {
  it('redacts the transcript by default (length only, never raw)', () => {
    const r = new VoiceFlightRecorder('t1', 0)
    r.noteTranscript('שלום מרתה סוד')
    expect(r.toReport()).toContain('[redacted len=')
    expect(r.toReport()).not.toContain('שלום מרתה סוד')
  })
  it('includes the raw transcript only when explicitly opted in', () => {
    const r = new VoiceFlightRecorder('t1', 0)
    r.setIncludeTranscripts(true)
    r.noteTranscript('hola')
    expect(r.toReport()).toContain('hola')
  })
  it('report names the FIRST MISSING STAGE and carries safe context (no raw audio)', () => {
    const r = new VoiceFlightRecorder('t1', 0)
    r.setContext({ path: 'realtime_voice', model: 'gpt-realtime', micTrack: { readyState: 'live', enabled: true, muted: false }, iceState: 'connected' })
    r.mark('USER_GESTURE_RECEIVED', 'ok', 1)
    const report = r.toReport()
    expect(report).toContain('FIRST MISSING STAGE')
    expect(report).toContain('path=realtime_voice')
    expect(report).toContain('ice=connected')
  })
})
