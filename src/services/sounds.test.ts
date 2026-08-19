import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getSoundMuted,
  setSoundMuted,
  toggleSoundMuted,
  subscribeSoundMuted,
  canPlay,
  isVoiceActive,
  haptic,
  soundTap,
  soundSuccess,
  soundSend,
  soundAlert,
  soundCopy,
  soundProcessing,
  soundOpen,
  soundNavigate,
  soundError,
  soundSaveCalendar,
  soundGameTap,
  soundRecordStart,
  soundRecordStop,
  soundLookup,
  soundToast,
  soundComplete,
  unlockAudio,
} from './sounds'

// The service runs under vitest's `node` environment: no window, no
// localStorage, no AudioContext, no DOM matchMedia. Every path must degrade to
// a silent no-op. These tests exercise the CENTRAL GATE — the one place all
// sound emissions are allowed or suppressed.

describe('sound mute gate', () => {
  beforeEach(() => {
    setSoundMuted(false) // reset in-memory state before each test
  })

  it('defaults to un-muted (sound enabled)', () => {
    expect(getSoundMuted()).toBe(false)
    expect(canPlay()).toBe(true)
  })

  it('mute suppresses playback via canPlay()', () => {
    setSoundMuted(true)
    expect(getSoundMuted()).toBe(true)
    expect(canPlay()).toBe(false)
  })

  it('un-mute re-enables playback', () => {
    setSoundMuted(true)
    setSoundMuted(false)
    expect(canPlay()).toBe(true)
  })

  it('toggleSoundMuted flips and returns the new state', () => {
    expect(getSoundMuted()).toBe(false)
    expect(toggleSoundMuted()).toBe(true)
    expect(getSoundMuted()).toBe(true)
    expect(toggleSoundMuted()).toBe(false)
    expect(getSoundMuted()).toBe(false)
  })

  it('notifies subscribers on change and can unsubscribe', () => {
    const seen: boolean[] = []
    const unsub = subscribeSoundMuted((m) => seen.push(m))
    setSoundMuted(true)
    setSoundMuted(false)
    expect(seen).toEqual([true, false])
    unsub()
    setSoundMuted(true)
    expect(seen).toEqual([true, false]) // no further notifications
  })

  it('isolates a throwing subscriber (others still notified)', () => {
    const seen: boolean[] = []
    const unsubBad = subscribeSoundMuted(() => { throw new Error('boom') })
    const unsubGood = subscribeSoundMuted((m) => seen.push(m))
    expect(() => setSoundMuted(true)).not.toThrow()
    expect(seen).toEqual([true])
    unsubBad()
    unsubGood()
  })
})

describe('voice-activity suppression (never step on AbuAI TTS)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setSoundMuted(false)
  })

  it('isVoiceActive is false with no window (node/SSR)', () => {
    expect(isVoiceActive()).toBe(false)
  })

  it('suppresses sound while speechSynthesis.speaking is true', () => {
    vi.stubGlobal('window', { speechSynthesis: { speaking: true } })
    expect(isVoiceActive()).toBe(true)
    expect(canPlay()).toBe(false)
  })

  it('allows sound when speechSynthesis exists but is not speaking', () => {
    vi.stubGlobal('window', { speechSynthesis: { speaking: false } })
    expect(isVoiceActive()).toBe(false)
    expect(canPlay()).toBe(true)
  })

  it('honors the optional read-only __abuAISpeaking hint', () => {
    vi.stubGlobal('window', { __abuAISpeaking: true })
    expect(isVoiceActive()).toBe(true)
    expect(canPlay()).toBe(false)
  })
})

describe('fail-silent: every sound is a safe no-op without a browser', () => {
  const allSounds = [
    soundTap, soundSuccess, soundSend, soundAlert, soundCopy, soundProcessing,
    soundOpen, soundNavigate, soundError, soundSaveCalendar, soundGameTap,
    soundRecordStart, soundRecordStop, soundLookup, soundToast, soundComplete, haptic,
    unlockAudio,
  ]

  it('does not throw when no AudioContext / navigator exists', () => {
    for (const fn of allSounds) {
      expect(() => fn()).not.toThrow()
    }
  })

  it('does not throw even when muted', () => {
    setSoundMuted(true)
    for (const fn of allSounds) {
      expect(() => fn()).not.toThrow()
    }
    setSoundMuted(false)
  })
})

describe('haptic respects mute and reduced-motion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setSoundMuted(false)
  })

  it('vibrates when enabled and motion is allowed', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    haptic()
    expect(vibrate).toHaveBeenCalledWith(15)
  })

  it('does NOT vibrate when muted', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    setSoundMuted(true)
    haptic()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('does NOT vibrate when prefers-reduced-motion is set', () => {
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    haptic()
    expect(vibrate).not.toHaveBeenCalled()
  })
})
