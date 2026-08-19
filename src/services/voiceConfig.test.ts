import { describe, it, expect } from 'vitest'
import { HE_VOICE, ES_VOICE, FALLBACK_VOICE, getVoiceProfile, getEffectiveRate, describeVoiceConfig } from './voiceConfig'

describe('voiceConfig — warmer, non-robotic voice targets', () => {
  it('uses the warm shimmer voice for both pipeline and realtime (not flat coral)', () => {
    expect(HE_VOICE.openaiVoice).toBe('shimmer')
    expect(HE_VOICE.realtimeVoice).toBe('shimmer')
    expect(ES_VOICE.openaiVoice).toBe('shimmer')
  })

  // Standing law: the benchmark is the latest ChatGPT at NORMAL human speech pace —
  // never slowed by DEFAULT. The applied default (no user override) must be 1.0, not
  // the old slowed 0.88/0.95. A user can still choose slower via the Settings profile.
  it('defaults to NORMAL human speech pace (1.0) — never slowed by default', () => {
    expect(HE_VOICE.rate).toBe(1.0)
    expect(ES_VOICE.rate).toBe(1.0)
    expect(getEffectiveRate('he', null)).toBe(1.0)
    expect(getEffectiveRate('es', null)).toBe(1.0)
    // A user override still wins (slower for those who want it), clamped sane.
    expect(getEffectiveRate('he', 0.9)).toBe(0.9)
  })

  it('keeps pitch neutral (no robotic shift)', () => {
    expect(HE_VOICE.pitch).toBe(1.0)
    expect(ES_VOICE.pitch).toBe(1.0)
  })

  it('selects the right profile by language and falls back to Hebrew', () => {
    expect(getVoiceProfile('he')).toBe(HE_VOICE)
    expect(getVoiceProfile('es')).toBe(ES_VOICE)
    expect(FALLBACK_VOICE).toBe(HE_VOICE)
  })

  it('honors a user speed override but clamps out robotic extremes', () => {
    expect(getEffectiveRate('he', 0.80)).toBe(0.80)     // valid override wins
    expect(getEffectiveRate('he', null)).toBe(HE_VOICE.rate) // no override → default
    expect(getEffectiveRate('he', 5)).toBeLessThanOrEqual(1.15)  // clamp fast
    expect(getEffectiveRate('he', 0.1)).toBeGreaterThanOrEqual(0.8) // clamp slow
    expect(getEffectiveRate('he', NaN)).toBe(HE_VOICE.rate)  // garbage → default
  })

  it('exposes a one-line debug summary', () => {
    expect(describeVoiceConfig()).toContain('shimmer')
  })
})
