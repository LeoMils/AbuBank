// Safe wrappers for audio (beep) and speech synthesis (TTS).
// All functions are fire-and-forget — silently degrade if browser blocks them.

const BEEP_DATAURI =
  'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA' +
  'EAAQAASAAAAQAIABAAZGFOYgYAAP8A/wD/AP8A/wD/AP8A/wD/AP8A'

let audioCtx: AudioContext | null = null

export function playReminderBeep(): void {
  try {
    if (typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext !== 'undefined') {
      if (!audioCtx) {
        const Ctx = (typeof AudioContext !== 'undefined' ? AudioContext : (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
        audioCtx = new Ctx()
      }
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume()
      }
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.value = 520
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4)
      osc.start(audioCtx.currentTime)
      osc.stop(audioCtx.currentTime + 0.4)
      return
    }
    // Fallback: data-URI audio element
    const audio = new Audio(BEEP_DATAURI)
    void audio.play().catch(() => { /* autoplay blocked — silent */ })
  } catch {
    // Any failure silently ignored — popup still shows
  }
}

export type TtsResult = 'spoken' | 'unavailable' | 'blocked'

/**
 * Attempt to speak text via browser TTS.
 * Returns 'spoken', 'unavailable', or 'blocked'.
 */
export function speakReminder(text: string): TtsResult {
  if (typeof window === 'undefined') return 'unavailable'
  const synth = window.speechSynthesis
  if (!synth) return 'unavailable'
  try {
    synth.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'he-IL'
    utt.rate = 0.9
    utt.pitch = 1.0
    synth.speak(utt)
    return 'spoken'
  } catch {
    return 'blocked'
  }
}

export function isTtsAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis
}
