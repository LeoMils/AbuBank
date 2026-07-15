/*
 * Source-contract regression for the Realtime audio-out autoplay fix
 * (docs/VOICE_ARCHITECTURE_VERDICT.md Q4). The remote <audio> element MUST be appended to
 * the DOM — a not-in-DOM media element is blocked by iOS/Android autoplay policy, which
 * made the Realtime session connect + stream audio while the user heard nothing. The full
 * behavior is DEVICE-GATED (WebRTC can't run in jsdom); this locks the wiring so the fix
 * can't silently regress.
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SRC = fs.readFileSync(path.resolve(__dirname, 'realtimeVoice.ts'), 'utf8')

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
