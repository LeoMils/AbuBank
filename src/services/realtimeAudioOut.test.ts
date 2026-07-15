/*
 * Source-contract regression for the Realtime audio-out autoplay fix
 * (docs/VOICE_ARCHITECTURE_VERDICT.md Q4). The remote <audio> element MUST be appended to
 * the DOM — a not-in-DOM media element is blocked by iOS/Android autoplay policy, which
 * made the Realtime session connect + stream audio while the user heard nothing. The full
 * behavior is DEVICE-GATED (WebRTC can't run in jsdom); this locks the wiring so the fix
 * can't silently regress.
 *
 * v2 (voice-realtime-audible): the reliable iOS pattern is MUTED-THEN-UNMUTE. The real
 * remote-audio element is PRIMED (created + play()ed muted) inside the tap gesture by the
 * caller (index.tsx), reused by the session, and UNMUTED once the WebRTC stream plays —
 * because an element first played outside a user gesture is autoplay-blocked on iOS Safari.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = fs.readFileSync(path.resolve(__dirname, 'realtimeVoice.ts'), 'utf8')
const INDEX = fs.readFileSync(path.resolve(__dirname, '../screens/AbuAI/index.tsx'), 'utf8')

describe('Realtime remote audio element is attached to the DOM (autoplay fix)', () => {
  it('appends the audio element to document.body', () => {
    expect(SRC).toMatch(/document\.body\.appendChild\(this\.audioEl\)/)
  })
  it('removes it from the DOM on teardown (no leaked hidden <audio>)', () => {
    expect(SRC).toMatch(/this\.audioEl\.remove\(\)/)
  })
  it('still handles a blocked play() (onAudioBlocked recovery kept)', () => {
    expect(SRC).toMatch(/onAudioBlocked/)
  })
})

describe('Realtime remote audio: muted-then-unmute via a gesture-primed element (iOS)', () => {
  it('the session reuses a caller-primed element instead of always creating a fresh one', () => {
    expect(SRC).toMatch(/this\.audioEl\s*=\s*this\.primedAudioEl\s*\?\?\s*document\.createElement\('audio'\)/)
  })
  it('the constructor accepts a primedAudioEl parameter', () => {
    expect(SRC).toMatch(/primedAudioEl:\s*HTMLAudioElement\s*\|\s*null\s*=\s*null/)
  })
  it('UNMUTES the element only after play() resolves (audible, no gesture needed to unmute)', () => {
    // muted=false must live inside the play().then success path, after AUDIO_PLAY_REQUESTED.
    const after = SRC.split('AUDIO_PLAY_REQUESTED')[1] ?? ''
    expect(after).toMatch(/this\.audioEl\.muted\s*=\s*false/)
  })
  it('does not double-append a primed element already in the DOM', () => {
    expect(SRC).toMatch(/if \(!this\.audioEl\.isConnected\)/)
  })
})

describe('index.tsx primes the remote-audio element INSIDE the tap gesture', () => {
  it('creates a muted primed <audio> element with a silent primer source', () => {
    expect(INDEX).toMatch(/primedRealtimeAudioEl/)
    expect(INDEX).toMatch(/el\.muted\s*=\s*true/)
    expect(INDEX).toMatch(/data:audio\/wav;base64,/)
  })
  it('passes the primed element into the RealtimeVoiceSession constructor', () => {
    expect(INDEX).toMatch(/primedRealtimeAudioEl,\s*\/\/ gesture-primed/)
  })
  it('priming happens in enterVoiceMode after unlockIOSAudio (gesture context)', () => {
    const unlockIdx = INDEX.indexOf('unlockIOSAudio()')
    const primeIdx = INDEX.indexOf('primedRealtimeAudioEl = el')
    expect(unlockIdx).toBeGreaterThan(-1)
    expect(primeIdx).toBeGreaterThan(unlockIdx)
  })
})

describe('Realtime instructions inject date grounding', () => {
  it('buildRealtimeInstructions computes a Hebrew date + time-of-day', () => {
    expect(INDEX).toMatch(/dateGrounding/)
    expect(INDEX).toMatch(/toLocaleDateString\('he-IL'/)
  })
  it('the date grounding is included in the returned instruction string', () => {
    expect(INDEX).toMatch(/\$\{dateGrounding\}\$\{calendarSnapshot\}/)
  })
})
