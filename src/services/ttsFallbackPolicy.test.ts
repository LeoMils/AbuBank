import { describe, it, expect } from 'vitest'
import { decideRealtimeAudioFallback } from './ttsFallbackPolicy'

describe('decideRealtimeAudioFallback — Realtime audio failure → pipeline TTS exactly once', () => {
  it('first failure with a reply → use the pipeline fallback', () => {
    const d = decideRealtimeAudioFallback('מור גרה בהוד השרון', false)
    expect(d.useFallback).toBe(true)
    expect(d.reply).toBe('מור גרה בהוד השרון')
    expect(d.showRecovery).toBe(false)
  })
  it('second failure (already used this turn) → show visible recovery, do NOT loop', () => {
    const d = decideRealtimeAudioFallback('מור גרה בהוד השרון', true)
    expect(d.useFallback).toBe(false)
    expect(d.reply).toBeNull()
    expect(d.showRecovery).toBe(true)
  })
  it('no reply to speak → show recovery (never fall back to silence)', () => {
    for (const empty of [null, undefined, '', '   ']) {
      const d = decideRealtimeAudioFallback(empty, false)
      expect(d.useFallback).toBe(false)
      expect(d.showRecovery).toBe(true)
    }
  })
})
