// Reminder alert: pleasant multi-tone chime + vibration + visual fallback.
// Designed for 80+ users: noticeable but not harsh.
// All functions fire-and-forget — silently degrade if browser blocks them.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = typeof AudioContext !== 'undefined'
        ? AudioContext
        : (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      audioCtx = new Ctx()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch { return null }
}

/**
 * Play a pleasant 3-note reminder chime: C5 → E5 → G5.
 * Each note 200ms with gentle fade. Total ~700ms.
 * Louder and more musical than the old single 520Hz beep.
 * Falls back to HTMLAudioElement, then vibration, then silent.
 */
export function playReminderBeep(): void {
  // Try vibration first (works even if audio is blocked on iOS)
  try { navigator.vibrate?.([200, 100, 200, 100, 300]) } catch { /* ok */ }

  const ctx = getAudioContext()
  if (ctx) {
    try {
      const notes = [523, 659, 784] // C5, E5, G5
      const now = ctx.currentTime
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = notes[i]!
        osc.connect(gain)
        gain.connect(ctx.destination)
        const start = now + i * 0.22
        gain.gain.setValueAtTime(0.35, start)
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.20)
        osc.start(start)
        osc.stop(start + 0.22)
      }
      // Second pass: repeat the chime after a short pause for emphasis
      for (let i = 0; i < notes.length; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = notes[i]!
        osc.connect(gain)
        gain.connect(ctx.destination)
        const start = now + 0.85 + i * 0.22
        gain.gain.setValueAtTime(0.25, start)
        gain.gain.exponentialRampToValueAtTime(0.01, start + 0.20)
        osc.start(start)
        osc.stop(start + 0.22)
      }
      return
    } catch { /* fall through */ }
  }

  // HTMLAudioElement fallback (unlikely to work on iOS without prior interaction)
  try {
    // Minimal WAV: 44100Hz, 8-bit, mono, 0.5s of 520Hz square wave
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YVoGAAD/')
    void audio.play().catch(() => { /* autoplay blocked */ })
  } catch { /* silent */ }
}

export type TtsResult = 'spoken' | 'unavailable' | 'blocked'

/**
 * Speak reminder text via browser TTS. Hebrew, slow rate for clarity.
 */
export function speakReminder(text: string): TtsResult {
  if (typeof window === 'undefined') return 'unavailable'
  const synth = window.speechSynthesis
  if (!synth) return 'unavailable'
  try {
    synth.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'he-IL'
    utt.rate = 0.85
    utt.pitch = 1.0
    utt.volume = 1.0
    synth.speak(utt)
    return 'spoken'
  } catch {
    return 'blocked'
  }
}

export function isTtsAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis
}
